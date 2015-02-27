2#!/usr/bin/env python
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

# Program to take a slice and generate a database table with, for each AM,
# ID  NAME  SIZE LONGITUDE LATITUDE COLOR
# where 
#   NAME is the name of the AM
#   SIZE is the number of nodes at that AM
#   LONGITUDE/LATITUDE are the long/lat of the AM
#   COLOR is the ready status (ready=GREEN, failed=RED, otherwise=GREY)


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
    parser.add_option("--agg_map_file", 
                      help="Location of current.json aggregate data file")
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

    if opts.agg_map_file == None:
        required_missing_fields.append('agg_map_file')
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
        self._agg_map_file = opts.agg_map_file

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
        self._unique_agg_urns_with_coordinates = [];

        db_url = "postgresql://%s:%s@%s/%s" % (self._dbuser, self._dbpass, 
                                               self._dbhost, self._dbname)
        self._db_engine = create_engine(db_url)

        # Make a unique table name based on project/slice
        self._db_table = self._slice_urn.split(':')[-1].replace('+slice+', '_')

        chapi_creds = self.get_slice_credentials()
        sfa_cred = chapi_creds[0]['geni_value']
        self._creds = [sfa_cred]

    def get_client(self, url):
        return self._framework.make_client(url, 
                                           self._key, self._cert,
                                           allow_none=True, verbose=False)
            
    # Read the aggreate data map JSON file
    def get_agg_map(self):
        agg_map_file = self._agg_map_file
        agg_map_data = open(agg_map_file, 'r').read();
        self._agg_map = json.loads(agg_map_data)
            
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
                if self.lookup_coordinates(agg_urn) != None:
                    self._unique_agg_urns_with_coordinates.append(agg_urn)

    # Get list of all aggreates from CH SR
    def get_aggregate_info(self):
        client = self.get_client(self._sr_url)
        fcn = eval('client.lookup_aggregates')
        suppress_errors = None
        reason = "Testing"
        (result, msg) = _do_ssl(self._framework, suppress_errors, reason, fcn,  {})
        self._aggregate_info = result['value']

    # Find coordinates (lat/long) for given aggreate
    # May return None if lat/long not available in AM advertisement
    def lookup_coordinates(self, agg_urn):
        for feature in self._agg_map['features']:
            properties = feature['properties']
            if properties['am_id'] == agg_urn:
                geometry = feature['geometry']
                return geometry['coordinates']
        return None

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

    # Turn a status (ready, failed, etc) into a color 
    # for drawing on the map
    def convert_status_to_color(self, status):
        status_lower = status.lower()
        if (status_lower == 'ready'):
            return 'green'
        elif (status_lower == 'failed'):
            return 'red'
        else:
            return 'gray';

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
        for agg_urn in self._unique_agg_urns_with_coordinates:
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
        for i in range(len(self._unique_agg_urns_with_coordinates)):
            agg_urn = self._unique_agg_urns_with_coordinates[i]
            am_links = links_by_am[agg_urn]
            for am_link in am_links:
                client_id = am_link.getAttribute('client_id')
                component_manager_elts = am_link.getElementsByTagName('component_manager')
                for cm_elt in component_manager_elts:
                    cm_name = cm_elt.getAttribute('name')
                    if cm_name not in links_by_am: continue
                    if cm_name == agg_urn: continue
                    # Only look forward in list of aggreates to avoid adding A<=>B and B<=>A
                    if self._unique_agg_urns_with_coordinates.index(cm_name) < i: continue
                    cm_link_elts = links_by_am[cm_name]
                    for cm_link_elt in cm_link_elts:
                        cm_link_client_id = cm_link_elt.getAttribute('client_id')
                        if cm_link_client_id != client_id: continue
                        if self.link_matches(cm_link_elt, cm_name, agg_urn):
                            stitched_link = {'am1' : agg_urn, 'am2' : cm_name, 'link_id' : client_id }
                            stitched_links.append(stitched_link)

        import pdb; pdb.set_trace()

        for stitched_link in stitched_links:
            link_id = stitched_link['link_id']
            am1_urn = stitched_link['am1']
            am2_urn = stitched_link['am2']
            am1_coords = self.lookup_coordinates(am1_urn)
            am2_coords = self.lookup_coordinates(am2_urn)
            print "   LINK %s <-> %s (%s) [%.2f, %.2f] [%.2f, %.2f]" % \
                (am1_urn, am2_urn, link_id, 
                 float(am1_coords[0]), float(am1_coords[1]), 
                 float(am2_coords[0]), float(am2_coords[1]))

    # See if a given link has a component_manager with given AM URN
    def link_matches(self, link_elt, link_agg_urn, search_agg_urn):
        found = False
        component_manager_elts = link_elt.getElementsByTagName('component_manager')
        import pdb; pdb.set_trace()
        for cm_elt in component_manager_elts:
            cm_name = cm_elt.getAttribute('name')
            if cm_name == search_agg_urn:
                found = True
                break
        return found

    # Go through all the gathered data and save information per aggregate:
    # name, size, lat/long, color
    def update_topology_table(self):

        insert_statements = []
        for agg_urn in self._unique_agg_urns:

            agg_info = self.get_agg_info_for_urn(agg_urn)
            agg_url = agg_info['SERVICE_URL']
            agg_name = agg_info['SERVICE_NAME']
            agg_coords = self.lookup_coordinates(agg_urn)
            sliver_status = self.lookup_status(agg_urn)
            agg_status = sliver_status['geni_status']
            agg_status_color = self.convert_status_to_color(agg_status)
            agg_size = self.get_aggregate_size(agg_urn)
            if agg_coords:
                longitude = float(agg_coords[0])
                latitude = float(agg_coords[1])
                print "   %s [%.2f %.2f] %s %d" % \
                    (agg_name, longitude, latitude, \
                    agg_status, agg_size)
                insert_template = "insert into %s (name, size, " + \
                    "longitude, latitude, color) " + \
                "values ('%s', %d, %.2f, %.2f, '%s')"
                insert_stmt =  insert_template % \
                    (self._db_table, agg_name, agg_size, \
                    longitude, latitude, agg_status_color)
                insert_statements.append(insert_stmt)


        # Create a database based on the slice_urn (if not already exists)
        conn = self._db_engine.connect()
        create_template = "create table %s (id serial primary key, " + \
            "name varchar, size integer, longitude float, latitude float, " + \
            "color varchar)"
        create_statement =  create_template % self._db_table
        try:
            conn.execute(create_statement);
        except:
#            print "%s already exists" % self._db_table
            pass

        trans = conn.begin() # Open transaction
        try:
            conn.execute("delete from %s" % self._db_table)
            for insert_stmt in insert_statements:
                conn.execute(insert_stmt)
            trans.commit() # Close transaction
        except:
            trans.rollback() # Rollback transaction
            raise 
        conn.close()

    # Top level routine for re-reading all data and updating database tables
    def run(self):

        # Read in the aggregate map data
        self.get_agg_map()

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
