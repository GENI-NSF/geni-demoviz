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
            
    def get_agg_map(self):
        agg_map_file = self._agg_map_file
        agg_map_data = open(agg_map_file, 'r').read();
        self._agg_map = json.loads(agg_map_data)
            
    def get_slice_credentials(self):
        client = self.get_client(self._sa_url)
        fcn = eval('client.get_credentials')
        suppress_errors = None
        reason = "Testing"
        (result, msg) = _do_ssl(self._framework, suppress_errors, reason, 
                                fcn,  self._slice_urn, [], {})
        return result['value']
        
    def get_sliver_info_for_slice(self):
        client = self.get_client(self._sa_url)
        fcn = eval('client.lookup_sliver_info')
        suppress_errors = None
        reason = "Testing"
        options = {"match" : {"SLIVER_INFO_SLICE_URN" : self._slice_urn}}
        (result, msg) = _do_ssl(self._framework, suppress_errors, reason, fcn,
                                self._creds, options)
        self._sliver_info = result['value']

    def get_aggregate_info(self):
        client = self.get_client(self._sr_url)
        fcn = eval('client.lookup_aggregates')
        suppress_errors = None
        reason = "Testing"
        (result, msg) = _do_ssl(self._framework, suppress_errors, reason, fcn,  {})
        self._aggregate_info = result['value']

    def lookup_coordinates(self, agg_urn):
        for feature in self._agg_map['features']:
            properties = feature['properties']
            if properties['am_id'] == agg_urn:
                geometry = feature['geometry']
                return geometry['coordinates']
        return None

    def get_agg_info_for_urn(self, am_urn):
        for agg_info in self._aggregate_info:
            if agg_info['SERVICE_URN'] == am_urn:
                return agg_info
        return None

    def get_all_sliver_status(self):
        for sliver_urn, sliver_details in self._sliver_info.iteritems():
            agg_urn = sliver_details['SLIVER_INFO_AGGREGATE_URN']
            agg_status = self.get_sliver_status(agg_urn)
            self._status_by_am[agg_urn] = agg_status

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

    def get_all_manifests(self):
        for sliver_urn, sliver_details in self._sliver_info.iteritems():
            agg_urn = sliver_details['SLIVER_INFO_AGGREGATE_URN']
            agg_manifest = self.get_manifest(agg_urn)
            self._manifest_by_am[agg_urn] = agg_manifest

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

    def lookup_status(self, am_urn):
        agg_status = self._status_by_am[am_urn]
        return agg_status

    def convert_status_to_color(self, status):
        status_lower = status.lower()
        if (status_lower == 'ready'):
            return 'green'
        elif (status_lower == 'failed'):
            return 'red'
        else:
            return 'gray';

    def update_topology_table(self):

        insert_statements = []
        agg_urns = set();
        for sliver_urn, sliver_details in self._sliver_info.iteritems():
            agg_urn = sliver_details['SLIVER_INFO_AGGREGATE_URN']

            # There may be many slivers from a single aggregate: 
            # Only compute once
            if agg_urn in agg_urns: continue;
            agg_urns.add(agg_urn)

            agg_info = self.get_agg_info_for_urn(agg_urn)
            agg_url = agg_info['SERVICE_URL']
            agg_name = agg_info['SERVICE_NAME']
            agg_coords = self.lookup_coordinates(agg_urn)
            sliver_status = self.lookup_status(agg_urn)
            agg_status = sliver_status['geni_status']
            agg_status_color = self.convert_status_to_color(agg_status)
            agg_size = len(sliver_status['geni_resources'])
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


def main():
    opts = parseOptions()

    gen = SliceTopologyGenerator(opts)

    while(True):

        print "%s: Invoking SliceTopologyGenerator for %s" % (time.asctime(), gen._slice_urn)

        # Read in the aggregate map data
        gen.get_agg_map()

        # Read in all aggregate info
        gen.get_aggregate_info()

        # Read in sliver info for sliver_urn
        gen.get_sliver_info_for_slice()

        # Read in sliver status for all aggregates for slice
        gen.get_all_sliver_status()

        # Read in manifestsfor all aggregates for slice
        gen.get_all_manifests()
        
        # Read the status for each aggregate for which there are slivers
        # And dump to database
        gen.update_topology_table()

        if opts.frequency <= 0: break
        time.sleep(float(opts.frequency))
        
    



if __name__ == "__main__":
    sys.exit(main())
