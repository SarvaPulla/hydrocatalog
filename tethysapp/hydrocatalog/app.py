from tethys_sdk.base import TethysAppBase, url_map_maker
from tethys_sdk.stores import PersistentStore

class HydroserverCatalog(TethysAppBase):
    """
    Tethys app class for HydroServer Catalog.
    """

    name = 'HydroServer Catalog'
    index = 'hydrocatalog:home'
    icon = 'hydrocatalog/images/cuahsi.png'
    package = 'hydrocatalog'
    root_url = 'hydrocatalog'
    color = '#004de6'
    description = 'Place a brief description of your app here.'
    enable_feedback = False
    feedback_emails = []


    def url_maps(self):
        """
        Add controllers
        """
        UrlMap = url_map_maker(self.root_url)

        url_maps = (UrlMap(name='home',
                           url='hydrocatalog',
                           controller='hydrocatalog.controllers.home'),
                    UrlMap(name='his-server',
                           url='hydrocatalog/his-server',
                           controller='hydrocatalog.controllers.get_his_server'),
                    UrlMap(name='soap',
                           url='hydrocatalog/soap',
                           controller='hydrocatalog.controllers.soap'),
                    UrlMap(name='catalog',
                           url='hydrocatalog/catalog',
                           controller='hydrocatalog.controllers.catalog'),
                    UrlMap(name='delete',
                           url='hydrocatalog/delete',
                           controller='hydrocatalog.controllers.delete'),
                    UrlMap(name='delete',
                           url='hydrocatalog/delete',
                           controller='hydrocatalog.controllers.delete'),
                    UrlMap(name='details',
                           url='hydrocatalog/details',
                           controller='hydrocatalog.controllers.details'),
                    UrlMap(name='soap-var',
                           url='hydrocatalog/soap-var',
                           controller='hydrocatalog.controllers.soap_var'),
                    UrlMap(name='soap-api',
                           url='hydrocatalog/soap-api',
                           controller='hydrocatalog.controllers.soap_api'),
                    UrlMap(name='xml',
                           url='hydrocatalog/xml',
                           controller='hydrocatalog.controllers.xml'),
                    UrlMap(name='error',
                           url='hydrocatalog/error',
                           controller='hydrocatalog.controllers.error'),
                    )

        return url_maps

    def persistent_stores(self):
        """
        Add one or more persistent stores
        """
        stores = (PersistentStore(name='hydroserver_catalog',
                                  initializer='hydrocatalog.init_stores.init_hydroserver_catalog'
                                  ),
                  )

        return stores