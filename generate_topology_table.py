#!/usr/bin/env python
#----------------------------------------------------------------------         
# Copyright (c) 2013-2015 Raytheon BBN Technologies                             
#                                                                               
# Permission is hereby granted, free of charge, to any person obtaining         
# a copy of this software and/or hardware specification (the "Work") to         
# deal in the Work without restriction, including without limitation the        
# rights to use, copy, modify, merge, publish, distribute, sublicense,          
# and/or sell copies of the Work, and to permit persons to whom the Work        
# is furnished to do so, subject to the following conditions:                   
#                                                                               
# The above copyright notice and this permission notice shall be                
# included in all copies or substantial portions of the Work.                   
#                                                                               
# THE WORK IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS           
# OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF                    
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND                         
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT                   
# HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,                  
# WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,            
# OUT OF OR IN CONNECTION WITH THE WORK OR THE USE OR OTHER DEALINGS            
# IN THE WORK.                                                                  
#----------------------------------------------------------------------         

import logging
import json
import optparse
from sqlalchemy import *
import sys
import time
from gcf.omnilib.util.dossl import _do_ssl
from gcf.omnilib.frameworks.framework_base import Framework_Base
from xml.dom.minidom import *

# Program to take a slice and generate a two database tables
#
# A NODES table with, for each AM, in the slice
# ID  SITE_ID NAME  ZOOM_LEVEL STATUS
# where 
#   SITE_ID is the index into the sites table
#   NAME is the name of the AM
#   ZOOM_LEVEL is ***
#   STATUS is up, down, error, unknown
#
# A Links table with, for each link
# ID, FROM_ID, FROM_IF_NAME, TO_ID, TO_IF_NAME, STATUS, LINK_ID


# Essentially we're mixing these sources of data:
#   - the sliver info for the slice (from CHAPI SA API)
#   - the AM info for each AM (from CHAPI SR API)
#   - the status from each sliver (from AM API sliverstatus)
#   - the lat/long of each AM (from current.json file)

# The program can be run in static (get current state and exit) mode
#  or dynamic (run every N seconds and re-write database table) mode

# Class for simple SSL client
class MAClientFramework(Framework_Base):
    def __init__(self, config, opts):
        Framework_Base.__init__(self, config)
        self.config = config
        self.logger = logging.getLogger('client')
        self.fwtype = "MA Ciient"
        self.opts = opts

# Main class for generating data tables representing state of GENI slice
class SliceTopologyGenerator:

    def __init__(self):

        opts = self.parse_options()
        self._opts = opts

        self._dbuser = opts.dbuser
        self._dbpass =  opts.dbpass
        self._dbhost = opts.dbhost
        self._dbname = opts.dbname
        self._dbport = opts.dbport

        db_url = "postgresql://%s:%s@%s:%s/%s" % (self._dbuser, self._dbpass, 
                                               self._dbhost, self._dbport, self._dbname)
        self._db_engine = create_engine(db_url)

        # Maintain table mapping sender_id (oml_id) to sender_name
        self._senders_info_by_id = {}
        self._senders_info_by_name = {}
        self._ch = opts.ch
        self._key = opts.key
        self._cert = opts.cert
        self._slice_urn = opts.slice_urn

        self._sites_table = opts.sites_table
        self._sites_info = {}

        self._clear_tables = opts.clear_tables

        self._frequency = float(opts.frequency)

        self._interface_name = opts.interface_name

        self._config = {'cert' : opts.cert, 'key' : opts.key}
        self._framework = MAClientFramework(self._config, {})
        self._sa_url = "https://%s/SA" % self._ch
        self._sr_url = "https://%s:8444/SR" % self._ch

        self._agg_map = None
        self._sliver_info = None
        self._aggregate_info = None
        self._status_by_am = {}
        self._manifest_by_am = {}

        self._unique_agg_urns = []
        self._unique_agg_urns_with_site_info = [];

        self._senders = opts.senders
        self._selected_senders = []

        # Make a unique table name based on project/slice, unless specified
        self._table_base = opts.table_base
        if self._table_base == None:
            self._table_base = self._slice_urn.split(':')[-1].replace('+slice+', '_')
            self._table_base = self._table_base.replace('-', '_')
        self._node_table = self._table_base + "_node"
        self._link_table = self._table_base + "_link"

        self._interface_info_by_site = {}
        self._node_info_by_site = {}
        self._node_info = []
        self._link_info = []

        chapi_creds = self.get_slice_credentials()
        sfa_cred = chapi_creds[0]['geni_value']
        self._creds = [sfa_cred]

    # Parse options provided by user
    def parse_options(self):
        argv = sys.argv[1:]
        parser = optparse.OptionParser()
        self.add_parser_options(parser)
        [opts, args] = parser.parse_args(argv)
        self.check_options(opts)
        return opts

    # Add parser options to parser
    # Override this method for superclasses
    def add_parser_options(self, parser):
        parser.add_option("--sites_table", 
                          help="Table with all known sites")
        parser.add_option("--slice_urn",
                          help="URN of slice for which to build topology")
        parser.add_option("--ch",
                          help="name of CH (e.g. ch.geni.net) at which slice resides")
        parser.add_option("--key",
                          help="Filename of x509 private key")
        parser.add_option("--cert",
                          help="Filename of x509 certificate")
        parser.add_option("--dbname", help="Name of database", default="gec22")
        parser.add_option("--dbhost", help="host of database", default="localhost")
        parser.add_option("--dbuser", help="Database user", default="oml2")
        parser.add_option("--dbpass", help="Database password", default="0mlisg00d4u")
        parser.add_option("--dbport", help="Database port", default="5432")
        parser.add_option("--table_base", 
                          help="Basename of node and link tables (usually based on slice_urn)", 
                          default=None)
        parser.add_option("--clear_tables", help="Clear output tables before writing to them", 
                          action='store_true', dest='clear_tables')
        parser.add_option("--no_clear_tables", help="Clear output tables before writing to them", 
                          action='store_false', dest='clear_tables')
        parser.add_option("--interface_name", help="Name of physical interface on links", 
                          default="eth1")
        parser.add_option("--cpu", help="Whether to draw CPU charts",
                          action="store_true", dest="cpu_chart")
        parser.add_option("--no_cpu", help="Whether to draw CPU charts",
                          action="store_false", dest="cpu_chart")
        parser.add_option("--memory", help="Whether to draw MEMORY charts",
                          action="store_true", dest="memory_chart")
        parser.add_option("--no_memory", help="Whether to draw MEMORY charts",
                          action="store_false", dest="memory_chart")
        parser.add_option("--network", help="Whether to draw NETWORK charts",
                          action="store_true", dest="network_chart")
        parser.add_option("--no_network", help="Whether to draw NETWORK charts",
                          action="store_false", dest="network_chart")
        parser.add_option("--frequency", help="Refresh frequency (<=0 means no refresh", 
                          default=0)
        parser.add_option("--sender", help="Name of sender (oml-id) for which to generate charts",
                          action="append", dest="senders")

    # Check that options are legitimate, fill in defaults, check for required
    # Override this method for superclasses
    def check_options(self, opts):
        # Default for clear tables (if not explicitly set), set to true
        if opts.clear_tables == None: opts.clear_tables = True

        # If no senders, set value to empty list
        if opts.senders == None: opts.senders = []

        # If unspecified, generate all chart types
        if opts.cpu_chart == None: opts.cpu_chart = True;
        if opts.memory_chart == None: opts.memory_chart = True;
        if opts.network_chart == None: opts.network_chart = True;

        required_missing_fields = [];

        if opts.sites_table == None:
            required_missing_fields.append('sites_table')
        if opts.slice_urn == None:
            required_missing_fields.append('slice_urn')
        if opts.ch == None:
            required_missing_fields.append("ch")
        if opts.key == None:
            required_missing_fields.append("key")
        if opts.cert == None:
            required_missing_fields.append("cert")

        if (len(required_missing_fields) > 0):
            raise Exception("Missing required arguments: " + 
                            " ".join(required_missing_fields))


    # Get SSL client for given cert/key/url
    def get_client(self, url):
        return self._framework.make_client(url, 
                                           self._key, self._cert,
                                           allow_none=True, verbose=False)

    # Read the sender info
    def get_sender_info(self):
        senders_query = "select id, name from _senders";
        result = self._db_engine.execute(senders_query)
        for row in result:
            sender_id = int(row['id'])
            sender_name = str(row['name'])
            self._senders_info_by_id[sender_id] = sender_name
            self._senders_info_by_name[sender_name] = sender_id

        # Associate the requested senders with IDs
        # Look up the senders by ID and keep this list for later chart generation
        for sender_name in self._senders:
            sender_id = self._senders_info_by_name[sender_name]
            self._selected_senders.append(sender_id)

            
    # Read the aggreate site info
    def get_site_info(self):
        select_stmt = "select id, am_urn, am_name, longitude, latitude from %s" % self._sites_table
        result = self._db_engine.execute(select_stmt)
        for row in result:
            am_id = row['id']
            am_urn = row['am_urn']
            am_name = row['am_name']
            self._sites_info[am_urn] = {'id' : am_id, 'name' :  am_name}


            
    # Get a slice credential for given user for given slice
    def get_slice_credentials(self):
        client = self.get_client(self._sa_url)
        fcn = eval('client.get_credentials')
        suppress_errors = None
        reason = "Testing"
        (result, msg) = _do_ssl(self._framework, suppress_errors, reason, 
                                fcn,  self._slice_urn, [], {})
        return result['value']
        
    # Get sliver info for given slice from CH SA
    def get_sliver_info_for_slice(self):
        client = self.get_client(self._sa_url)
        fcn = eval('client.lookup_sliver_info')
        suppress_errors = None
        reason = "Testing"
        options = {"match" : {"SLIVER_INFO_SLICE_URN" : self._slice_urn}}
        (result, msg) = _do_ssl(self._framework, suppress_errors, reason, fcn,
                                self._creds, options)
        self._sliver_info = result['value']

        # Set up unique list of AM urn's
        for sliver_urn, sliver_details in self._sliver_info.iteritems():
            agg_urn = sliver_details['SLIVER_INFO_AGGREGATE_URN']
            if agg_urn not in self._unique_agg_urns:
                self._unique_agg_urns.append(agg_urn);
                if agg_urn in self._sites_info:
                    self._unique_agg_urns_with_site_info.append(agg_urn)

    # Get list of all aggreates from CH SR
    def get_aggregate_info(self):
        client = self.get_client(self._sr_url)
        fcn = eval('client.lookup_aggregates')
        suppress_errors = None
        reason = "Testing"
        (result, msg) = _do_ssl(self._framework, suppress_errors, reason, fcn,  {})
        self._aggregate_info = result['value']

        # Add additional aggregates not in SR
        wix = {'SERVICE_URL' : 'http://wixam.maxgigapop.net:12346',
               'SERVICE_NAME' : 'WIX',
               'SERVICE_URN' : 'urn:publicid:IDN+wix.internet2.edu+authority+am'}
        self._aggregate_info.append(wix)

    # Find the aggregate info for given am_urn
    def get_agg_info_for_urn(self, am_urn):
        for agg_info in self._aggregate_info:
            if agg_info['SERVICE_URN'] == am_urn:
                return agg_info
        return None

    # Get sliver status for all AM's containing slivers in slice
    def get_all_sliver_status(self):
        for sliver_urn, sliver_details in self._sliver_info.iteritems():
            agg_urn = sliver_details['SLIVER_INFO_AGGREGATE_URN']
            agg_status = self.get_sliver_status(agg_urn)
            self._status_by_am[agg_urn] = agg_status


    # Get sliver status for particular AM (V2)
    def get_sliver_status(self, am_urn):
        am_info = self.get_agg_info_for_urn(am_urn)
        if am_info == None: 
            print "AM not registered: %s" % am_urn
            return None
        am_url = am_info['SERVICE_URL']
        client = self.get_client(am_url)
        fcn = eval('client.SliverStatus')
        suppress_errors = None
        reason = "Testing"
        (result, msg) = _do_ssl(self._framework, suppress_errors, reason, 
                                fcn,  self._slice_urn, self._creds, {})
        status = result['value']
        return status

    # Get manifest for all AM's containing slivers in slice
    def get_all_manifests(self):
        for sliver_urn, sliver_details in self._sliver_info.iteritems():
            agg_urn = sliver_details['SLIVER_INFO_AGGREGATE_URN']
            agg_manifest = self.get_manifest(agg_urn)
            if agg_manifest:
                self._manifest_by_am[agg_urn] = agg_manifest

    # Get manifest for specific AM (V2)
    def get_manifest(self, am_urn):
        am_info = self.get_agg_info_for_urn(am_urn)
        if am_info == None: 
            print "AM not registered: %s" % am_urn
            return None
        am_url = am_info['SERVICE_URL']
        client = self.get_client(am_url)
        fcn = eval('client.ListResources')
        suppress_errors = None
        reason = "Testing"
        options = {'geni_slice_urn' : self._slice_urn,
                   'geni_rspec_version' : {'version' : '3', 'type' : 'GENI'},
                   'geni_compressed' : False}
        (result, msg) = _do_ssl(self._framework, suppress_errors, reason, 
                                fcn,  self._creds, options)
        if result['code']['geni_code'] != 0:
            return None
        status = result['value']
        return status

    # Pull status from status cache by AM urn
    def lookup_status(self, am_urn):
        agg_status = self._status_by_am[am_urn]
        return agg_status

    # Lookup site URN from site ID
    def lookup_site_urn_from_site_id(self, site_id):
        for site_urn, site_info in self._sites_info.iteritems():
            if site_info['id'] == site_id:
                return site_urn
        return None

    # Lookup the node presenting given interface at given aggreate
    def lookup_node_for_interface(self, agg_urn, interface):
        for iface_info in self._interface_info_by_site[agg_urn]:
            iface_name = iface_info['interface']
            node_name = iface_info['node']
            if iface_name == interface:
                return node_name
        return None

    # Lookup node id from site_id and node client_id
    def lookup_node_id(self, site_id, client_id):
        for node_info in self._node_info:
            if node_info['site_id'] == site_id and \
                    node_info['client_id'] == client_id:
                return node_info['id']
        return None

    # Find status of link resource on given node
    def lookup_link_status(self, node_id, link_id):
        site_id = None
        for node_info in self._node_info:
            if node_info['id'] == node_id:
                site_id = node_info['site_id']
                break
        agg_urn = self.lookup_site_urn_from_site_id(site_id)
        status = self._status_by_am[agg_urn]
        for res in status['geni_resources']:
            if res['geni_client_id'] == link_id:
                return res['geni_status']
        return 'Unknown'

    # Turn am status (ready, failed, etc) into 
    # standard status (up, down, unknown, error)
    # for drawing on the map
    def convert_am_status_to_status(self, status):
        status_lower = status.lower()
        if (status_lower == 'ready'):
            return 'up'
        elif (status_lower == 'failed'):
            return 'error'
        else:
            return 'unknown';

    # Combine status from two interfaces to an overal link status
    def combine_status(self, status1, status2):
        if status1 == "unknown" or status2 == "unknown":
            return "unknown"
        elif status1 == "error" or status2 == "error":
            return "error"
        elif status1 == "up" and status2 == "up":
            return "up"
        else:
            return "down"


    # Get list of client_id's on nodes manifest
    def get_aggregate_client_ids(self, agg_urn):
        if agg_urn not in self._manifest_by_am: return []
        manifest = self._manifest_by_am[agg_urn]
        manifest_doc = parseString(manifest)
        nodes = manifest_doc.getElementsByTagName('node')
        client_ids = []
        for node in nodes:
            if node.hasAttribute('component_manager_id') and \
                    node.getAttribute('component_manager_id') != agg_urn:
                                          continue
            client_id = node.getAttribute('client_id')
            client_ids.append(client_id)
        return client_ids

    # Generate cross-aggregate links
    # Two cases: 
    #    Stitched: Find links on with same client ID on different am's which have 
    #        one another's component_managers
    #    SharedVLAN : TBD
    def generate_links(self):
        stitched_links = []
        links_by_am = {}
        for agg_urn in self._unique_agg_urns_with_site_info:
            if agg_urn not in self._manifest_by_am: continue
            manifest = self._manifest_by_am[agg_urn]
            manifest_doc = parseString(manifest)
            manifest_root = manifest_doc.getElementsByTagName('rspec')[0]
            am_links = []
            for child in manifest_root.childNodes:
                if child.nodeType == Node.ELEMENT_NODE and \
                        child.nodeName == 'link':
                    am_links.append(child)
            links_by_am[agg_urn] = am_links

        # For each am, for each link, get the client ID and list of component_managers
        # If that component manager has a link of same name and a component_manager of this link
        # Save this as a stitched link
        for i in range(len(self._unique_agg_urns_with_site_info)):
            agg_urn = self._unique_agg_urns_with_site_info[i]
            if agg_urn not in links_by_am: continue
            am_links = links_by_am[agg_urn]
            for am_link in am_links:
                client_id = am_link.getAttribute('client_id')
                component_manager_elts = am_link.getElementsByTagName('component_manager')
                interface1 = self.lookup_interface(am_link)
                node1 = self.lookup_node_for_interface(agg_urn, interface1)
                status1 = 'unknown'
                for cm_elt in component_manager_elts:
                    cm_name = cm_elt.getAttribute('name')
                    if cm_name not in links_by_am: continue
                    if cm_name == agg_urn: continue
                    # Only look forward in list of aggreates to avoid adding A<=>B and B<=>A
                    if self._unique_agg_urns_with_site_info.index(cm_name) < i: continue
                    cm_link_elts = links_by_am[cm_name]
                    for cm_link_elt in cm_link_elts:
                        cm_link_client_id = cm_link_elt.getAttribute('client_id')
                        if cm_link_client_id != client_id: continue
                        if self.link_matches(cm_link_elt, cm_name, agg_urn):
                            interface2 = self.lookup_interface(cm_link_elt)
                            node2 = self.lookup_node_for_interface(agg_urn, interface2)
                            status2 = 'unknown'
                            status = self.combine_status(status1, status2)
#                            print "STATUS1 = %s STATUS2 = %s COMBO = %s" % (status1, status2, status)
                            stitched_link = {'am1' : agg_urn, 'am2' : cm_name, 'link_id' : client_id ,
                                             'node1' : node1, 'node2' : node2, 
                                             'interface1' : interface1, 'interface2' : interface2, 
                                             'status' : status}
                            stitched_links.append(stitched_link)

        conn = self._db_engine.connect()
        create_template = "create table %s (id serial primary key, " +\
            "from_id integer, from_if_name varchar, to_id integer, " + \
            "to_if_name varchar, status varchar, link_id varchar)";
        create_statement = create_template % self._link_table
        try:
            conn.execute(create_statement);
        except:
#            print "%s already exists" % self._link_table
            pass


        insert_stmts = []
        for stitched_link in stitched_links:
            link_id = stitched_link['link_id']
            am1_urn = stitched_link['am1']
            am2_urn = stitched_link['am2']
            am1_if = stitched_link['interface1']
            am2_if = stitched_link['interface2']
            physical_interface1 = self._interface_name
            physical_interface2 = self._interface_name
            am1_info = self._sites_info[am1_urn]
            am2_info = self._sites_info[am2_urn]
            am1_site_id = self._sites_info[am1_urn]['id']
            am1_node_name = self.lookup_node_for_interface(am1_urn, am1_if)
            am1_node_id = self.lookup_node_id(am1_site_id, am1_node_name)
            am2_site_id = self._sites_info[am2_urn]['id']
            am2_node_name = self.lookup_node_for_interface(am2_urn, am2_if)
            am2_node_id = self.lookup_node_id(am2_site_id, am2_node_name)
            link_status = 'unknown'
            if am1_node_id == None:
                print "Unknown node: URN %s IF %s NAME %s" % (am1_urn, am2_if, am2_node_name)
            if am2_node_id == None:
                print "Unknown node: URN %s IF %s NAME %s" % (am2_urn, am2_if, am2_node_name)
            if am1_node_id is not None and am2_node_id is not None:
                print "   LINK %s <-> %s (%s) %d %d"  % \
                    (am1_urn, am2_urn, link_id, am1_node_id, am2_node_id)
                insert_template = "insert into %s (from_id, from_if_name, " + \
                    "to_id, to_if_name, status, link_id) values " +\
                    "(%d, '%s', %d, '%s', '%s', '%s')"

                insert_stmt = insert_template % (self._link_table, am1_node_id, 
                                                 physical_interface1, 
                                                 am2_node_id, physical_interface2,
                                                 link_status, link_id)
                insert_stmts.append(insert_stmt)

        trans = conn.begin() # Open transaction
        try:
            if self._clear_tables:
                conn.execute("delete from %s" % self._link_table)
            for insert_stmt in insert_stmts:
                conn.execute(insert_stmt)
            trans.commit()
        except:
            trans.rollback() # Rollback transaction
            raise

        conn.close()

        # Keep link information for later updates
        select_stmt = "select id, from_id, to_id, link_id from %s" % self._link_table
        result = self._db_engine.execute(select_stmt)
        for row in result:
            id = row.id
            from_id = row.from_id
            to_id = row.to_id
            link_id = row.link_id
            link = {'id' : id, 'from_id' : from_id, 'to_id' : to_id, 'link_id' : link_id}
            self._link_info.append(link)

    # Find the sliver_status for given am for given client_id
    def get_sliver_status_for_client_id(self, agg_urn, client_id):
        status = "unknown"
        for sliver_status in self._status_by_am[agg_urn]['geni_resources']:
            if sliver_status['geni_client_id'] == client_id:
                status = sliver_status['geni_status']
                break;
        return status

    # Find the name of the interface on the link that has a sliver associated with it
    def lookup_interface(self, link_elt):
        interface_name = ""
        refs = link_elt.getElementsByTagName('interface_ref')
        for ref in refs:
            if ref.hasAttribute('sliver_id'):
                interface_name = ref.getAttribute('client_id')
                break
        return interface_name

    # See if a given link has a component_manager with given AM URN
    def link_matches(self, link_elt, link_agg_urn, search_agg_urn):
        found = False
        component_manager_elts = link_elt.getElementsByTagName('component_manager')
        for cm_elt in component_manager_elts:
            cm_name = cm_elt.getAttribute('name')
            if cm_name == search_agg_urn:
                found = True
                break
        return found

    # Go through all the gathered data and save information per aggregate:
    # site_id, name, size, status
    def generate_nodes(self):

        insert_statements = []
        for agg_urn in self._unique_agg_urns:

            agg_info = self.get_agg_info_for_urn(agg_urn)
            if agg_info == None: continue
            agg_url = agg_info['SERVICE_URL']
            agg_name = agg_info['SERVICE_NAME']
            status = 'unknown'
            client_ids = self.get_aggregate_client_ids(agg_urn)
            if agg_urn in self._sites_info:
                site_info = self._sites_info[agg_urn]
                site_id = site_info['id']
                for client_id in client_ids:
                    print "   %d %s %s" % \
                        (site_id, agg_name, client_id)
                    insert_template = "insert into %s (site_id, name, client_id, status) " + \
                        "values (%d, '%s', '%s', '%s')"
                    insert_stmt =  insert_template % \
                        (self._node_table, site_id, agg_name, client_id, status)
                    insert_statements.append(insert_stmt)


        # Create a database based on the slice_urn (if not already exists)
        conn = self._db_engine.connect()
        create_template = "create table %s (id serial primary key, " + \
            "site_id integer, name varchar, client_id varchar, " + \
            "zoom_level integer default 0, status varchar, sender varchar)";
        create_statement =  create_template % self._node_table
        try:
            conn.execute(create_statement);
        except:
#            print "%s already exists" % self._node_table
            pass

        trans = conn.begin() # Open transaction
        try:
            if self._clear_tables:
                conn.execute("delete from %s" % self._node_table)
            for insert_stmt in insert_statements:
                conn.execute(insert_stmt)
            trans.commit() # Close transaction
        except:
            trans.rollback() # Rollback transaction
            raise 
        conn.close()

        # Establish connection of node_id (in node table) with site_id (in site table)
        query_template = "select id, site_id, client_id from %s";
        result = self._db_engine.execute(query_template % self._node_table)
        for row in result:
            node_id = row['id']
            site_id = row['site_id']
            client_id = row['client_id']
            if site_id not in self._node_info_by_site:
                self._node_info_by_site[site_id] = []
            node_info = {'id' : node_id, 'client_id' : client_id, 'site_id' : site_id}
            self._node_info_by_site[site_id].append(node_info)
            self._node_info.append(node_info)

        # Establish table of site => node/interface
        for agg_urn in self._unique_agg_urns_with_site_info:
            if agg_urn not in self._interface_info_by_site:
                self._interface_info_by_site[agg_urn] = []

            if agg_urn not in self._manifest_by_am: continue
            manifest = self._manifest_by_am[agg_urn]
            manifest_doc = parseString(manifest)
            nodes = manifest_doc.getElementsByTagName('node')
            for node in nodes:
                node_name = node.getAttribute('client_id')
                component_manager_id = node.getAttribute('component_manager_id')
                if component_manager_id != agg_urn: continue
                interfaces = node.getElementsByTagName('interface')
                for iface in interfaces:
                    iface_name = iface.getAttribute('client_id')
                    iface_info = {'interface' : iface_name, 'node' : node_name}
                    self._interface_info_by_site[agg_urn].append(iface_info)
    
    # Generate ".md" script file  for map and graphs
    # *** Need to loop over list of senders ***
    def generate_script_file(self):
        script_filename = self._table_base + ".md"
        script_file = open(script_filename, 'wb');

        map_template = open('map.md.template', 'r').read()
        map_script = map_template % (self._node_table, self._sites_table, 
                                     self._link_table, self._node_table, self._node_table)
        script_file.write(map_script)

        if len(self._selected_senders) > 0:
            sender_ids = "";
            for i in range(len(self._selected_senders)):
                if (i > 0): sender_ids = sender_ids + ", "
                sender_ids = sender_ids + str(self._selected_senders[i])

            if self._opts.cpu_chart:
                cpu_template = open('cpu.md.template', 'r').read()
                cpu_script = cpu_template % (sender_ids)
                cpu_script = cpu_script.replace('***PERCENT***', '%')
                script_file.write(cpu_script)
                
            if self._opts.memory_chart:
                memory_template = open('memory.md.template', 'r').read()
                memory_script = memory_template % (sender_ids)
                memory_script = memory_script.replace('***PERCENT***', '%')
                script_file.write(memory_script)

            if self._opts.network_chart:
                network_template = open('network.md.template', 'r').read()
                network_script = network_template % (sender_ids)
                network_script = network_script.replace('***PERCENT***', '%')
                script_file.write(network_script)

        script_file.close()

    # Update nodes wit current status
    def update_nodes(self):
        for agg_urn in self._unique_agg_urns_with_site_info:
            agg_status = self._status_by_am[agg_urn]
            agg_site_id = self._sites_info[agg_urn]['id']
            if agg_status is None: continue
            for res in agg_status['geni_resources']:
                if 'geni_client_id' not in res or 'geni_status' not in res: continue
                node_name = res['geni_client_id']
                node_status = res['geni_status']
                status = self.convert_am_status_to_status(node_status)
                node_update_status_statement = \
                    "update %s set status = '%s' where site_id = %d and client_id = '%s'" % \
                    (self._node_table, status, agg_site_id, node_name)
                self._db_engine.execute(node_update_status_statement)
        
    # Update links with current status
    def update_links(self):
        for link in self._link_info:
            link_id = link['link_id']
            id = link['id']
            from_node_id = link['from_id']
            to_node_id = link['to_id']
            from_am_status = self.lookup_link_status(from_node_id, link_id)
            from_status = self.convert_am_status_to_status(from_am_status)
            to_am_status = self.lookup_link_status(to_node_id, link_id)
            to_status = self.convert_am_status_to_status(to_am_status)
            link_status = self.combine_status(from_status, to_status)
            link_update_status_statement = \
                "update %s set status = '%s' where id = %d" % \
                (self._link_table, link_status, id)
            self._db_engine.execute(link_update_status_statement)

    # Are all statuses in a terminal (failed, ready) state?
    def all_statuses_terminal(self):
        all_terminal = True
        for agg_urn, agg_status in self._status_by_am.iteritems():
            status = agg_status['geni_status']
            if status not in ['ready', 'failed']:
                all_terminal = False
                break;
        return all_terminal


    # Top level routine for re-reading all data and updating database tables
    def run(self):

        print "%s: Invoking SliceTopologyGenerator for %s" % (time.asctime(), self._slice_urn)

        # Parse sender info
        self.get_sender_info()

        # Generate aggreagte MD (map and graphs) script file
        print "%s: Generatoring %s.md script file" % (time.asctime(), self._table_base)
        self.generate_script_file()

        # Read in the aggregate site info
        print "%s: Loading site info" % (time.asctime())
        self.get_site_info()

        # Read in all aggregate info
        print "%s: Loading aggregate info for slice %s " % (time.asctime(), self._slice_urn)
        self.get_aggregate_info()

        # Read in sliver info for sliver_urn
        print "%s: Loading sliver info for slice %s " % (time.asctime(), self._slice_urn)
        self.get_sliver_info_for_slice()

        # Read in manifestsfor all aggregates for slice
        print "%s: Loading manifest info for slice %s " % (time.asctime(), self._slice_urn)
        self.get_all_manifests()
        
        # Read the status for each aggregate for which there are slivers
        # And dump to database
        print "%s: Generating nodes table for slice %s" % (time.asctime(), self._slice_urn)
        self.generate_nodes()

        # Generate cross-aggreate links
        print "%s: Generating links table for slice %s" % (time.asctime(), self._slice_urn)
        self.generate_links()

        # Read in sliver status for all aggregates for slice
        print "%s: Loading sliver status info for slice %s " % (time.asctime(), self._slice_urn)
        self.get_all_sliver_status()
        self.update_nodes()
        self.update_links()


        # Keep updating links until all aggreates are in terminal state
        while True:
            if self._frequency <= 0: 
                break
            if self.all_statuses_terminal():
                break;
            time.sleep(self._frequency)
            print "%s: Loading sliver status info for slice %s " % (time.asctime(), self._slice_urn)
            self.get_all_sliver_status()
            self.update_nodes()
            self.update_links()


def main():
    gen = SliceTopologyGenerator()

    gen.run()

if __name__ == "__main__":
    sys.exit(main())
