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


# Fill in the 'sites' table

# Parse options provided by user
def parseOptions():
    argv = sys.argv[1:]
    parser = optparse.OptionParser()
    parser.add_option("--agg_map_file", 
                      help="Location of current.json aggregate data file")
    parser.add_option("--dbname", help="Name of database", default="gec22")
    parser.add_option("--dbhost", help="host of database", default="localhost")
    parser.add_option("--dbuser", help="Database user", default="oml2")
    parser.add_option("--dbpass", help="Database password", default="0mlisg00d4u")
    parser.add_option("--sites_tablename", help="Name of table for sites")

    [opts, args] = parser.parse_args(argv)

    required_missing_fields = [];

    if opts.agg_map_file == None:
        required_missing_fields.append('agg_map_file')
    if opts.sites_tablename == None:
        required_missing_fields.append('sites_tablename')

    if (len(required_missing_fields) > 0):
        raise Exception("Missing required arguments: " + 
                        " ".join(required_missing_fields))

    return opts



class SiteTableGenerator:
    def __init__(self, opts):
        self._agg_map_file = opts.agg_map_file
        self._sites_tablename = opts.sites_tablename

        self._dbuser = opts.dbuser
        self._dbpass =  opts.dbpass
        self._dbhost = opts.dbhost
        self._dbname = opts.dbname

        db_url = "postgresql://%s:%s@%s/%s" % (self._dbuser, self._dbpass, 
                                               self._dbhost, self._dbname)
        self._db_engine = create_engine(db_url)


    def generate(self):
        agg_map_file = self._agg_map_file
        agg_map_data = open(agg_map_file, 'r').read();
        self._agg_map = json.loads(agg_map_data)

        unique_sites = {}
        for feature in self._agg_map['features']:
            geometry = feature['geometry']
            properties = feature['properties']
            longitude = float(geometry['coordinates'][0])
            latitude = float(geometry['coordinates'][1])
            am_urn = properties['am_id']
            am_name = properties['am']
            unique_sites[am_urn] = \
                {'am_name' : am_name, 'longitude' : longitude, 'latitude' : latitude}
        conn = self._db_engine.connect()
        create_template = "create table %s (id serial primary key, " + \
            "am_urn varchar, am_name varchar, longitude float, latitude float)"
        create_statement =  create_template % self._sites_tablename
        try:
            conn.execute(create_statement);
        except:
#            print "%s already exists" % self._sites_tablename
            pass

        
        delete_stmt = "delete from %s" % self._sites_tablename
        conn.execute(delete_stmt);

        for am_urn, properties in unique_sites.iteritems():
            am_name = properties['am_name']
            longitude = properties['longitude']
            latitude = properties['latitude']
            template = "insert into %s (am_urn, am_name, longitude, latitude) values ('%s', '%s', %.2f, %.2f)";
            insert_stmt = template % (self._sites_tablename, am_urn, am_name, longitude, latitude)
            conn.execute(insert_stmt);

        conn.close()

def main():
    opts = parseOptions()

    gen = SiteTableGenerator(opts)
    gen.generate()



if __name__ == "__main__":
    sys.exit(main())


