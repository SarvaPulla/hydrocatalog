from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponse
from tethys_sdk.services import get_spatial_dataset_engine, list_spatial_dataset_engines
from tethys_dataset_services.engines import GeoServerSpatialDatasetEngine
from django.contrib.sites.shortcuts import get_current_site
from django.conf import settings
from json import dumps, loads
import urllib2
import xml.etree.ElementTree as ET
from xml.etree.ElementTree import XML, fromstring, tostring
from utilities import *
import xmltodict, json
from datetime import datetime, timedelta
from tethys_sdk.gizmos import TimeSeries, SelectInput, DatePicker, TextInput
from tethys_sdk.gizmos import MapView, MVDraw, MVView, MVLayer, MVLegendClass, GoogleMapView
import time, calendar
from suds.client import Client
from django.core import serializers
import logging
import unicodedata
import ast
from pyproj import Proj, transform
from owslib.waterml.wml11 import WaterML_1_1 as wml11
from .model import engine, SessionMaker, Base, Catalog

logging.getLogger('suds.client').setLevel(logging.CRITICAL)
geo_url_base = getattr(settings, "GEOSERVER_URL_BASE", "http://127.0.0.1:8181")
geo_user = getattr(settings, "GEOSERVER_USER_NAME", "admin")
geo_pw = getattr(settings, "GEOSERVER_USER_PASSWORD", "geoserver")


@login_required()
def home(request):
    """
    Controller for the app home page.
    """
    # Retrieving HydroServers from CUAHSI Central
    his_servers = []

    his_url = "http://hiscentral.cuahsi.org/webservices/hiscentral.asmx?WSDL"
    client = Client(his_url)
    service_info = client.service.GetWaterOneFlowServiceInfo()
    services = service_info.ServiceInfo
    for i in services:
        try:
            url = str(i.servURL)
            title = str(i.Title)
            organization = str(i.organization)
            variable_str = "Title: %s, Organization: %s" % (title, organization)
            his_servers.append([variable_str, url])
        except Exception as e:
            print e
    select_his_server = SelectInput(display_text='Select HIS Server', name="select_server", multiple=False,
                                    options=his_servers)





    context = {"select_his_server":select_his_server}

    return render(request, 'hydrocatalog/home.html', context)

def get_his_server(request):
    server = {}
    if request.is_ajax() and request.method == 'POST':
        url = request.POST['select_server']
        server['url'] = url
    return JsonResponse(server)

def soap(request):
    return_obj = {}

    if request.is_ajax() and request.method == 'POST':
        logging.getLogger('suds.client').setLevel(logging.CRITICAL)
        geo_url = geo_url_base + "/geoserver/rest/"
        url = request.POST['soap-url']
        title = request.POST['soap-title']
        title = title.replace(" ", "")
        true_extent = request.POST.get('extent')

        client = Client(url)

        if true_extent == 'on':

            extent_value = request.POST['extent_val']
            return_obj['zoom'] = 'true'
            return_obj['level'] = extent_value
            ext_list = extent_value.split(',')
            inProj = Proj(init='epsg:3857')
            outProj = Proj(init='epsg:4326')
            minx, miny = ext_list[0], ext_list[1]
            maxx, maxy = ext_list[2], ext_list[3]
            x1, y1 = transform(inProj, outProj, minx, miny)
            x2, y2 = transform(inProj, outProj, maxx, maxy)
            bbox = client.service.GetSitesByBoxObject(x1, y1, x2, y2, '1', '')
            wml_sites = parseWML(bbox)

            shapefile_object = genShapeFile(wml_sites, title, geo_url, geo_user, geo_pw, url)
            geoserver_rest_url = geo_url_base + "/geoserver/wms"
            return_obj['rest_url'] = geoserver_rest_url
            return_obj['wms'] = shapefile_object["layer"]
            return_obj['bounds'] = shapefile_object["extents"]
            extents_string = str(shapefile_object["extents"])

            # extents_dict = xmltodict.parse(extents_string)
            # extents_json_object = json.dumps(extents_dict)
            # extents_json = json.loads(extents_json_object)

            return_obj['title'] = title
            return_obj['url'] = url
            return_obj['status'] = "true"

            Base.metadata.create_all(engine)
            session = SessionMaker()
            hs_one = Catalog(title=title,
                             url=url, geoserver_url=geoserver_rest_url, layer_name=shapefile_object["layer"],
                             extents=extents_string)
            session.add(hs_one)
            session.commit()
            session.close()


        else:
            return_obj['zoom'] = 'false'
            sites = client.service.GetSites('[:]')
            # sites = sites.encode('utf-8')
            # wml_sites = wml11(sites).response
            sites_dict = xmltodict.parse(sites)
            sites_json_object = json.dumps(sites_dict)
            sites_json = json.loads(sites_json_object)
            sites_object = parseJSON(sites_json)
            shapefile_object = genShapeFile(sites_object, title, geo_url, geo_user, geo_pw, url)

            geoserver_rest_url = geo_url_base + "/geoserver/wms"
            return_obj['rest_url'] = geoserver_rest_url
            return_obj['wms'] = shapefile_object["layer"]
            return_obj['bounds'] = shapefile_object["extents"]
            extents_string = str(shapefile_object["extents"])
            return_obj['title'] = title
            return_obj['url'] = url
            return_obj['status'] = "true"

            Base.metadata.create_all(engine)
            session = SessionMaker()
            hs_one = Catalog(title=title,
                             url=url, geoserver_url=geoserver_rest_url, layer_name=shapefile_object["layer"],
                             extents=extents_string)
            session.add(hs_one)
            session.commit()
            session.close()

    else:
        return_obj['message'] = 'This request can only be made through a "POST" AJAX call.'


    return JsonResponse(return_obj)

def catalog(request):

    list = {}

    session = SessionMaker()

    # Query DB for hydroservers
    hs_catalog = session.query(Catalog).all()

    hs_list = []
    for server in hs_catalog:
        layer_obj = {}
        layer_obj["geoserver_url"] = server.geoserver_url
        layer_obj["title"] = server.title
        layer_obj["url"] = server.url
        layer_obj["layer_name"] = server.layer_name
        json_encoded = ast.literal_eval(server.extents)
        layer_obj["extents"] = json_encoded

        hs_list.append(layer_obj)
    list["hydroserver"] = hs_list

    return JsonResponse(list)

def delete(request):
    list = {}

    session = SessionMaker()

    # Query DB for hydroservers
    if request.is_ajax() and request.method == 'POST':
        title = request.POST['server']
        geo_url = geo_url_base + "/geoserver/rest/"
        spatial_dataset_engine = GeoServerSpatialDatasetEngine(endpoint=geo_url, username=geo_user,
                                                               password=geo_pw)
        store_string = "catalog" + ":" + str(title)
        spatial_dataset_engine.delete_layer(layer_id=store_string,purge=True)
        spatial_dataset_engine.delete_store(store_id=store_string,purge=True)
        hydroservers = session.query(Catalog).filter(Catalog.title == title).delete(synchronize_session='evaluate')
        session.commit()
        session.close()

        # spatial_dataset_engine.delete_store(title,purge=True,debug=True)
        list["title"] = title
    return JsonResponse(list)

def details(request):
    site_name = request.GET['sitename']
    site_code = request.GET['sitecode']
    network = request.GET['network']
    hs_url = request.GET['hsurl']
    hidenav = request.GET['hidenav']
    service = request.GET['service']
    rest = None
    soap = None
    error_message = None

    if service == 'SOAP':
        soap_obj = {}
        soap = service
        soap_obj["url"] = hs_url

        client = Client(hs_url)
        client.set_options(port='WaterOneFlow')
        site_desc = network + ":" + site_code
        soap_obj["site"] = site_desc
        soap_obj["network"] = network
        site_info = client.service.GetSiteInfo(site_desc)
        site_info = site_info.encode('utf-8')
        # site_values = client.service.GetValuesForASiteObject(site_desc,"","","")
        # print site_values
        info_dict = xmltodict.parse(site_info)
        info_json_object = json.dumps(info_dict)
        info_json = json.loads(info_json_object)
        # print site_values
        # print info_json
        site_variables = []
        site_object_info = info_json['sitesResponse']['site']['seriesCatalog']
        # print info_json
        try:
            site_object = info_json['sitesResponse']['site']['seriesCatalog']['series']
        except KeyError:
            error_message = "Site Details do not exist"
            context = {"site_name": site_name, "site_code": site_code, "service": service,
                       "error_message": error_message}
            return render(request, 'hydrocatalog/error.html', context)
        graph_variables = []
        var_json = []
        if type(site_object) is list:
            count = 0
            for i in site_object:
                var_obj = {}
                count = count + 1

                variable_name = i['variable']['variableName']
                variable_id = i['variable']['variableCode']['@variableID']
                variable_text = i['variable']['variableCode']['#text']
                var_obj["variableName"] = variable_name
                var_obj["variableID"] = variable_id
                # value_type = i['variable']['valueType']
                value_count = i['valueCount']
                # data_type = i['variable']['dataType']
                # unit_name = i['variable']['unit']['unitName']
                # unit_type = i['variable']['unit']['unitType']
                # unit_abbr = i['variable']['unit']['unitAbbreviation']
                # unit_code = i['variable']['unit']['unitCode']
                # time_support = i['variable']['timeScale']['timeSupport']
                # time_support_name = i['variable']['timeScale']['unit']['unitName']
                # time_support_type = i['variable']['timeScale']['unit']['unitAbbreviation']
                begin_time = i["variableTimeInterval"]["beginDateTimeUTC"]
                begin_time = begin_time.split("T")
                begin_time = str(begin_time[0])
                end_time = i["variableTimeInterval"]["endDateTimeUTC"]
                end_time = end_time.split("T")
                end_time = str(end_time[0])
                var_obj["startDate"] = begin_time
                var_obj["endDate"] = end_time
                # print begin_time,end_time
                method_id = i["method"]["@methodID"]
                # method_desc = i["method"]["methodDescription"]
                # source_id = i["source"]["@sourceID"]
                # source_org = i["source"]["organization"]
                # source_desc = i["source"]["sourceDescription"]
                # qc_code = i["qualityControlLevel"]["qualityControlLevelCode"]
                # qc_id = i["qualityControlLevel"]["@qualityControlLevelID"]
                # qc_definition = i["qualityControlLevel"]["definition"]
                # print variable_name,variable_id, source_id,method_id, qc_code
                variable_string = str(
                    count) + '. Variable Name:' + variable_name + ',' + 'Count: ' + value_count + ',Variable ID:' + variable_id + ', Start Date:' + begin_time + ', End Date:' + end_time
                # value_string = variable_id,variable_text,source_id,method_id,qc_code, variable_name
                value_list = [variable_text, method_id]
                value_string = str(value_list)
                graph_variables.append([variable_string, value_string])
                var_json.append(var_obj)
                # print variable_name, variable_id, value_type, data_type, unit_name,unit_type, unit_abbr,unit_abbr,unit_code, time_support, time_support_name, time_support_type
        else:
            var_obj = {}
            variable_name = site_object['variable']['variableName']
            variable_id = site_object['variable']['variableCode']['@variableID']
            variable_text = site_object['variable']['variableCode']['#text']
            value_count = site_object['valueCount']

            # value_type = site_object['variable']['valueType']
            # data_type = site_object['variable']['dataType']
            # unit_name = site_object['variable']['unit']['unitName']
            # unit_type = site_object['variable']['unit']['unitType']
            # unit_abbr = site_object['variable']['unit']['unitAbbreviation']
            # unit_code = site_object['variable']['unit']['unitCode']
            # time_support = site_object['variable']['timeScale']['timeSupport']
            # time_support_name = site_object['variable']['timeScale']['unit']['unitName']
            # time_support_type = site_object['variable']['timeScale']['unit']['unitAbbreviation']
            begin_time = site_object["variableTimeInterval"]["beginDateTimeUTC"]
            begin_time = begin_time.split("T")
            begin_time = str(begin_time[0])
            end_time = site_object["variableTimeInterval"]["endDateTimeUTC"]
            end_time = end_time.split("T")
            end_time = str(end_time[0])
            method_id = site_object["method"]["@methodID"]
            # method_desc = site_object["method"]["methodDescription"]
            # source_id = site_object["source"]["@sourceID"]
            # source_org = site_object["source"]["organization"]
            # source_desc = site_object["source"]["sourceDescription"]
            # qc_code = site_object["qualityControlLevel"]["qualityControlLevelCode"]
            # qc_id = site_object["qualityControlLevel"]["@qualityControlLevelID"]
            # qc_definition = site_object["qualityControlLevel"]["definition"]
            variable_string = '1. Variable Name:' + variable_name + ',' + 'Count: ' + value_count + ',Variable ID:' + variable_id + ', Start Date:' + begin_time + ', End Date:' + end_time
            # print variable_name, variable_id, source_id, method_id, qc_code
            value_list = [variable_text, method_id]
            value_string = str(value_list)
            var_obj["variableName"] = variable_name
            var_obj["variableID"] = variable_id
            var_obj["startDate"] = begin_time
            var_obj["endDate"] = end_time
            var_json.append(var_obj)
            graph_variables.append([variable_string, value_string])

        select_soap_variable = SelectInput(display_text='Select Variable', name="select_var", multiple=False,
                                           options=graph_variables)

        t_now = datetime.now()
        now_str = "{0}-{1}-{2}".format(t_now.year, check_digit(t_now.month), check_digit(t_now.day))
        start_date = DatePicker(name='start_date',
                                display_text='Start Date',
                                autoclose=True,
                                format='yyyy-mm-dd',
                                start_view='month',
                                today_button=True,
                                initial=now_str)
        end_date = DatePicker(name='end_date',
                              display_text='End Date',
                              autoclose=True,
                              format='yyyy-mm-dd',
                              start_view='month',
                              today_button=True,
                              initial=now_str)

        select_variable = []
        graphs_object = {}
        json.JSONEncoder.default = lambda self, obj: (obj.isoformat() if isinstance(obj, datetime) else None)
        soap_obj["var_list"] = var_json
        request.session['soap_obj'] = soap_obj

        context = {"site_name": site_name, "site_code": site_code, "network": network, "hs_url": hs_url,
                   "service": service, "rest": rest, "soap": soap, "hidenav": hidenav,
                   "select_soap_variable": select_soap_variable, "select_variable": select_variable,
                   "start_date": start_date, "end_date": end_date, "graphs_object": graphs_object, "soap_obj": soap_obj,
                   "error_message": error_message}

        return render(request, 'hydrocatalog/details.html', context)

def soap_var(request):
    var_object = None
    if 'soap_obj' in request.session:
        var_object = request.session['soap_obj']
    return JsonResponse(var_object)

def soap_api(request):
    graph_json = None
    if 'soap_obj' in request.session:
            soap_object = request.session['soap_obj']
            url = soap_object['url']
            site_desc = soap_object['site']
            network = soap_object['network']
            variable =  request.POST['select_var']
            start_date = request.POST["start_date"]
            end_date = request.POST["end_date"]
            var_data = {}
            var_data['variable'] = variable
            var_data['start_date'] = start_date
            var_data['end_date'] = end_date
            request.session['var_data'] = var_data
            variable = str(variable)
            variable = variable.replace("[","").replace("]","").replace("u","").replace(" ","").replace("'","")
            variable = variable.split(',')
            variable_text = variable[0]
            variable_method = variable[1]
            variable_desc = network+':'+variable_text
            client = Client(url)
            values = client.service.GetValues(site_desc,variable_desc,start_date,end_date,"")
            values_dict = xmltodict.parse(values)
            values_json_object = json.dumps(values_dict)
            values_json = json.loads(values_json_object)
            times_series = values_json['timeSeriesResponse']['timeSeries']
            if times_series['values'] is not None:
                graph_json = {}
                graph_json["variable"] = times_series['variable']['variableName']
                graph_json["unit"] = times_series['variable']['unit']['unitAbbreviation']
                graph_json["title"] = site_desc + ':' + times_series['variable']['variableName']
                for j in times_series['values']:
                    data_values = []
                    if j == "value":
                        if type((times_series['values']['value'])) is list:
                            count = 0
                            for k in times_series['values']['value']:
                                if k['@methodCode'] == variable_method:
                                    count = count + 1
                                    time = k['@dateTimeUTC']
                                    time1 = time.replace("T", "-")
                                    time_split = time1.split("-")
                                    year = int(time_split[0])
                                    month = int(time_split[1])
                                    day = int(time_split[2])
                                    hour_minute = time_split[3].split(":")
                                    hour = int(hour_minute[0])
                                    minute = int(hour_minute[1])
                                    value = float(str(k['#text']))
                                    date_string = datetime(year, month, day, hour, minute)
                                    time_stamp = calendar.timegm(date_string.utctimetuple()) * 1000
                                    data_values.append([time_stamp, value])
                                    data_values.sort()
                                graph_json["values"] = data_values
                                graph_json["count"] = count
                        else:
                            if times_series['values']['value']['@methodCode'] == variable_method:
                                time = times_series['values']['value']['@dateTimeUTC']
                                time1 = time.replace("T", "-")
                                time_split = time1.split("-")
                                year = int(time_split[0])
                                month = int(time_split[1])
                                day = int(time_split[2])
                                hour_minute = time_split[3].split(":")
                                hour = int(hour_minute[0])
                                minute = int(hour_minute[1])
                                value = float(str(times_series['values']['value']['#text']))
                                date_string = datetime(year, month, day, hour, minute)
                                time_stamp = calendar.timegm(date_string.utctimetuple()) * 1000
                                data_values.append([time_stamp, value])
                                data_values.sort()
                                graph_json["values"] = data_values
                                graph_json["count"] = 1


    return JsonResponse(graph_json)

def error(request):
    context = {}
    return render(request, 'hydrocatalog/error.html', context)

def xml(request):
    xml_response = None
    if 'var_data' in request.session:
        soap_object = request.session['soap_obj']
        url = soap_object['url']
        site_desc = soap_object['site']
        network = soap_object['network']
        var_object = request.session['var_data']
        variable = var_object['variable']
        start_date = var_object['start_date']
        end_date = var_object['end_date']
        variable = str(variable)
        variable = variable.replace("[", "").replace("]", "").replace("u", "").replace(" ", "").replace("'", "")
        variable = variable.split(',')
        variable_text = variable[0]
        variable_method = variable[1]
        variable_desc = network + ':' + variable_text
        client = Client(url)
        values = client.service.GetValues(site_desc, variable_desc, start_date, end_date, "")
        xml_response = HttpResponse(values, content_type='application/xml')
        filename = site_desc+".xml"
        xml_response['Content-Disposition'] = "attachment; filename="+filename

    return xml_response
