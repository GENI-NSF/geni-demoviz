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

class MAClientFramework(Framework_Base):
    def __init__(self, config, opts):
        Framework_Base.__init__(self, config)
        self.config = config
        self.logger = logging.getLogger('client')
        self.fwtype = "MA Ciient"
        self.opts = opts

# Parse options provided by user
def parseOptions():
    argv = sys.argv[1:]
    parser = optparse.OptionParser()
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
    parser.add_option("--frequency", help="Refresh frequency (<=0 means no refresh", default=0);


    [opts, args] = parser.parse_args(argv)

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

    return opts

# Main class for generating data tables representing state of GENI slice
class SliceTopologyGenerator:

    def __init__(self, opts):
        self._ch = opts.ch
        self._key = opts.key
        self._cert = opts.cert
        self._slice_urn = opts.slice_urn

        self._sites_table = opts.sites_table
        self._sites_info = {}

        self._dbuser = opts.dbuser
        self._dbpass =  opts.dbpass
        self._dbhost = opts.dbhost
        self._dbname = opts.dbname

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

        db_url = "postgresql://%s:%s@%s/%s" % (self._dbuser, self._dbpass, 
                                               self._dbhost, self._dbname)
        self._db_engine = create_engine(db_url)

        # Make a unique table name based on project/slice
        table_base = self._slice_urn.split(':')[-1].replace('+slice+', '_')
        self._node_table = table_base + "_node"
        self._link_table = table_base + "_link"

        chapi_creds = self.get_slice_credentials()
        sfa_cred = chapi_creds[0]['geni_value']
        self._creds = [sfa_cred]

    def get_client(self, url):
        return self._framework.make_client(url, 
                                           self._key, self._cert,
                                           allow_none=True, verbose=False)
            
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
            self._manifest_by_am[agg_urn] = agg_manifest

    # Get manifest for specific AM (V2)
    def get_manifest(self, am_urn):
        am_info = self.get_agg_info_for_urn(am_urn)
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
        status = result['value']
        return status

    # Pull status from status cache by AM urn
    def lookup_status(self, am_urn):
        agg_status = self._status_by_am[am_urn]
        return agg_status

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

    def combine_status(self, status1, status2):
        if status1 == "unknown" or status2 == "unknown":
            return "unknown"
        elif status1 == "error" or status2 == "error":
            return "error"
        elif status1 == "up" and status2 == "up":
            return "up"
        else:
            return "down"


    # Count nnumber of nodes in manifest
    def get_aggregate_size(self, agg_urn):
        num_nodes = self._manifest_by_am[agg_urn].count('<node');
        return num_nodes

    # Generate cross-aggregate links
    # Two cases: 
    #    Stitched: Find links on with same client ID on different am's which have 
    #        one another's component_managers
    #    SharedVLAN : TBD
    def generate_links(self):
        stitched_links = []
        links_by_am = {}
        for agg_urn in self._unique_agg_urns_with_site_info:
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
            am_links = links_by_am[agg_urn]
            for am_link in am_links:
                client_id = am_link.getAttribute('client_id')
                component_manager_elts = am_link.getElementsByTagName('component_manager')
                interface1 = self.lookup_interface(am_link)
                am_status1 = self.get_sliver_status_for_client_id(agg_urn, client_id)
                status1 = self.convert_am_status_to_status(am_status1)
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
                            am_status2 = self.get_sliver_status_for_client_id(cm_name, client_id)
                            status2 = self.convert_am_status_to_status(am_status2)
                            status = self.combine_status(status1, status2)
                            print "STATUS1 = %s STATUS2 = %s COMBO = %s" % (status1, status2, status)
                            stitched_link = {'am1' : agg_urn, 'am2' : cm_name, 'link_id' : client_id ,
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
            am1_info = self._sites_info[am1_urn]
            am2_info = self._sites_info[am2_urn]
            am1_site_id = self._sites_info[am1_urn]['id']
            am2_site_id = self._sites_info[am2_urn]['id']
            am1_if = stitched_link['interface1']
            am2_if = stitched_link['interface2']
            link_status = stitched_link['status']
            print "   LINK %s <-> %s (%s) %d %d"  % \
                (am1_urn, am2_urn, link_id, am1_site_id, am2_site_id)
            insert_template = "insert into %s (from_id, from_if_name, " + \
                "to_id, to_if_name, status, link_id) values " +\
                "(%d, '%s', %d, '%s', '%s', '%s')"

            insert_stmt = insert_template % (self._link_table, am1_site_id, am1_if, \
                                                 am2_site_id, am2_if, link_status, link_id)
            insert_stmts.append(insert_stmt)

        trans = conn.begin() # Open transaction
        try:
            conn.execute("delete from %s" % self._link_table)
            for insert_stmt in insert_stmts:
                conn.execute(insert_stmt)
            trans.commit()
        except:
            trans.rollback() # Rollback transaction
            raise

        conn.close()

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
    def update_topology_table(self):

        insert_statements = []
        for agg_urn in self._unique_agg_urns:

            agg_info = self.get_agg_info_for_urn(agg_urn)
            agg_url = agg_info['SERVICE_URL']
            agg_name = agg_info['SERVICE_NAME']
            sliver_status = self.lookup_status(agg_urn)
            agg_status = sliver_status['geni_status']
            status = self.convert_am_status_to_status(agg_status)
            agg_size = self.get_aggregate_size(agg_urn)
            if agg_urn in self._sites_info:
                site_info = self._sites_info[agg_urn]
                site_id = site_info['id']
                print "   %d %s %s %d" % \
                    (site_id, agg_name, agg_status, agg_size)
                insert_template = "insert into %s (site_id, name, status) " + \
                "values (%d, '%s', '%s')"
                insert_stmt =  insert_template % \
                    (self._node_table, site_id, agg_name, status)
                insert_statements.append(insert_stmt)


        # Create a database based on the slice_urn (if not already exists)
        conn = self._db_engine.connect()
        create_template = "create table %s (id serial primary key, " + \
            "site_id integer, name varchar, zoom_level integer default 0, status varchar)";
        create_statement =  create_template % self._node_table
        try:
            conn.execute(create_statement);
        except:
#            print "%s already exists" % self._node_table
            pass

        trans = conn.begin() # Open transaction
        try:
            conn.execute("delete from %s" % self._node_table)
            for insert_stmt in insert_statements:
                conn.execute(insert_stmt)
            trans.commit() # Close transaction
        except:
            trans.rollback() # Rollback transaction
            raise 
        conn.close()

    # Top level routine for re-reading all data and updating database tables
    def run(self):

        # Read in the aggregate site info
        self.get_site_info()

        # Read in all aggregate info
        self.get_aggregate_info()

        # Read in sliver info for sliver_urn
        self.get_sliver_info_for_slice()

        # Read in sliver status for all aggregates for slice
        self.get_all_sliver_status()

        # Read in manifestsfor all aggregates for slice
        self.get_all_manifests()
        
        # Read the status for each aggregate for which there are slivers
        # And dump to database
        self.update_topology_table()

        # Generate cross-aggreate links
        self.generate_links()



def main():
    opts = parseOptions()

    gen = SliceTopologyGenerator(opts)

    while(True):

        print "%s: Invoking SliceTopologyGenerator for %s" % (time.asctime(), gen._slice_urn)

        gen.run()

        # If we're not iterating, get out. Otherwise sleep and restart
        if opts.frequency <= 0: break
        time.sleep(float(opts.frequency))
        
    



if __name__ == "__main__":
    sys.exit(main())
