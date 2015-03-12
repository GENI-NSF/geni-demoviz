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

# Script to synchronize a set of CSV files with a database for                                   
# GEC22 demo visualizations                                                                      

import time;
import optparse
import os
import sys

# Names of hosts for which there will be files                                                   
hosts = ['canarie', 'chicago', 'ebi', 'nih', 'starlight'];

# Class to synchronize data                                                                      
class DataSynchronizer:

    def __init__(self):

        self._opts = self.parse_options();

        # Keep a mapping of host to the last entry written for that host                         
        # (so we only write new entries)                                                         
        self._latest_time_per_host = {}
        for host in hosts:
            self._latest_time_per_host[host] = None;


    # Add options to parser                                                                      
    def add_parser_options(self, parser):
        parser.add_option('--outfile', help='Name of outputfile')
        parser.add_option("--dbname", help="Name of database", default="gec22")
        parser.add_option("--dbhost", help="host of database")
        parser.add_option("--dbuser", help="Database user", default="oml2")
        parser.add_option("--dbpass", help="Database password", default="0mlisg00d4u")
        parser.add_option("--dbport", help="Database port", default="5432")
        parser.add_option("--dbtable", help="Name of database table")
        parser.add_option("--dbtable_link", help="Name of database link table")
        parser.add_option('--dbfield', help="Name of field of value")

    # Check that all required parser arguments are provided                                      
    def check_options(self, opts):
        required_missing_fields = []
        if opts.outfile == None: required_missing_fields.append('outfile')
        if opts.dbhost == None: required_missing_fields.append('dbhost')
        if opts.dbtable== None: required_missing_fields.append('dbtable')
        if opts.dbfield== None: required_missing_fields.append('dbfield')

	if len(required_missing_fields) > 0:
            raise Exception("Missing required arguments: " +
                            " ".join(required_missing_fields))

    # Name of filename for given host (Internaltion SDX demo specific)                           
    def filename_for_host(self, host, towards_sl):
	if towards_sl:
            return "/tmp/links/%s2slSDX" % host
	else:
            return "/tmp/links/slSDX2%s" % host

    # Parse command line options                                                                 
    def parse_options(self):
       argv = sys.argv[1:]
       parser = optparse.OptionParser()
       self.add_parser_options(parser)
       [opts, args] = parser.parse_args(argv)
       self.check_options(opts)
       return opts

    def link_statement(self, sql_file, host, status):
        update_statement = "update %s set status = '%s' where link_id = '%s-link';\n" % \
            (self._opts.dbtable_link, status, host)
        sql_file.write(update_statement);

    # Parse given file (indicated by name and towards_sl)                                        
    # If exists, parse and generate insert statements                                            
    # Otherwise, return false                                                                    
    def process_file(self, sql_file, host, towards_sl):
        host_filename = self.filename_for_host(host, towards_sl)
        data_exists = False
        host_data = None
        try:
            host_data = open(host_filename, 'r').read()
            data_exists = True
        except:
            pass
        if data_exists:
            print "Processing file %s" % host_filename
            lines = host_data.split('\n');
            for line in lines:
                if line == '': continue
                parts = line.split('\t');
		ts = int(parts[0])
                value = int(parts[1])
                insert_stmt = "insert into %s (ts, %s, sender) values (%d, %d, '%s');\n" % \
                    (self._opts.dbtable, self._opts.dbfield, ts, value, host)
                if ts > self._latest_time_per_host[host]:
                    sql_file.write(insert_stmt)
                    self._latest_time_per_host[host] = ts
        return data_exists

    # Create an SQL file with appropriate transaction boundaries                                 
    # To clean out old tables and enter new entries                                              
    # Then execute the SQL file                                                                  
    def run(self):
        # Open file                                                                              
	sql_file = open(self._opts.outfile, 'wb')
        # Add 'begin transaction;"                                                               
	sql_file.write('begin transaction;\n')
        for host in hosts:
            if self._latest_time_per_host[host] == None:
                sql_file.write("delete from %s where sender = '%s';\n" % \
                                   (self._opts.dbtable, host))
            towards_exists = self.process_file(sql_file, host, True)
            from_exists = self.process_file(sql_file, host, False)
            if towards_exists or from_exists:
		# Enable link                                                                    
		self.link_statement(sql_file, host, 'up');
            else:
                # Disable link                                                                   
                self.link_statement(sql_file, host, 'down');


        # Add 'commit';                                                                          
        sql_file.write('commit;\n')
        # Close file                                                                             
        sql_file.close()

        # Invoke SQL file                                                                        
	sql_cmd = "PGPASSWORD=%s psql -U %s -h %s %s -f %s" % \
            (self._opts.dbpass, self._opts.dbuser, self._opts.dbhost,
             self._opts.dbname, self._opts.outfile)
        print "INVOKING CMD = %s" % sql_cmd
        os.system(sql_cmd)

# Run indefinitely, only adding new rows                                                         
def main():
    sd = DataSynchronizer();
    while True:
        sd.run()
        time.sleep(2)




if __name__ == "__main__":
    sys.exit(main())

