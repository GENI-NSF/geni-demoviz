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

# Script to generate generic metrics and 
# and write these to a database of form
# TS v1 v2 v3 sender

# To support GEC22 demo visualizations                                                                      

import time
import optparse
import os
import sys

# Generic class to grab and store metrics
class MetricGenerator:

    def __init__(self):

        self._opts = self.parse_options();


    # Add options to parser                                                                      
    def add_parser_options(self, parser):
        parser.add_option("--dbname", help="Name of database", default="gec22")
        parser.add_option("--dbhost", help="host of database")
        parser.add_option("--dbuser", help="Database user", default="oml2")
        parser.add_option("--dbpass", help="Database password", default="0mlisg00d4u")
        parser.add_option("--dbport", help="Database port", default="5432")
        parser.add_option("--dbtable", help="Name of database table")
        parser.add_option('--sender', help="Name of sender/host/server associated with metrics");

    # Check that all required parser arguments are provided                                      
    def check_options(self, opts):
        required_missing_fields = []
        if opts.dbhost == None: required_missing_fields.append('dbhost')
        if opts.dbtable == None: required_missing_fields.append('dbtable')
        if opts.sender == None: required_missing_fields.append('sender')

	if len(required_missing_fields) > 0:
            raise Exception("Missing required arguments: " +
                            " ".join(required_missing_fields))

    # Parse command line options                                                                 
    def parse_options(self):
       argv = sys.argv[1:]
       parser = optparse.OptionParser()
       self.add_parser_options(parser)
       [opts, args] = parser.parse_args(argv)
       self.check_options(opts)
       return opts

    # Get names of metrics
    def getMetricNames(self):
        return []

    # Get values of metrics
    def getMetricValues(self):
        return []


    # Create an insert statement for all metrics
    # insert in database
    def run(self):
        timestamp = int(time.time())
        metric_names = self.getMetricNames()
        metric_values = self.getMetricValues()
        stringified_metric_values = [str(v) for v in metric_values]
        insert_stmt = "insert into %s (ts, %s, sender) values (%d, %s, '%s')" % \
            (self._opts.dbtable, ",".join(metric_names), 
             timestamp, ",".join(stringified_metric_values), self._opts.sender)
#        print insert_stmt

        # Invoke SQL file                                                                        
	sql_cmd = "PGPASSWORD=%s psql -U %s -h %s %s -c %c%s%c" % \
            (self._opts.dbpass, self._opts.dbuser, self._opts.dbhost,
             self._opts.dbname, '"', insert_stmt, '"')
#       print "INVOKING CMD = %s" % sql_cmd
        os.system(sql_cmd)

# Run indefinitely, only adding new rows                                                         
def main():
    sd = DataSynchronizer();
    while True:
        sd.run()
        time.sleep(2)




if __name__ == "__main__":
    sys.exit(main())

