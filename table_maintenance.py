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

# Script to maintain GEC22 data tables, archiving data older than 24 hours

import optparse
import os
import sys
import time

# The tables maintained by this script
maintained_tables = [
    {'tablename' : 'bvermeulen_sdx', 'id_column' : 'id'},
    {'tablename' : 'msb_metrics', 'id_column' : 'id'},
    {'tablename' : 'nriganikytopo2', 'id_column' : 'id'},
    {'tablename' : 'starlight_metrics', 'id_column' : 'id'},
    {'tablename' : 'nmetrics_cpu', 'id_column' : 'oml_tuple_id'},
    {'tablename' : 'nmetrics_memory', 'id_column' : 'oml_tuple_id'},
    {'tablename' : 'nmetrics_network', 'id_column' : 'oml_tuple_id'}
                     ]

class TableMaintainer():
    def __init__(self):
        self._opts = self.parse_options()


    def add_parser_options(self, parser):
        parser.add_option("--dbname", help="Name of database", default="gec22")
        parser.add_option("--dbhost", help="host of database", default='localhost')
        parser.add_option("--dbuser", help="Database user", default="oml2")
        parser.add_option("--dbpass", help="Database password", default="0mlisg00d4u")
        parser.add_option("--dbport", help="Database port", default="5432")
        parser.add_option("--outfile", help="Database script filename")
        parser.add_option('--frequency', help="How often to gather metrics in seconds", 
                          default="3600")
        parser.add_option("--window", help="Length of window of data maintained in tables",
                          default="86400")

    # Check that all required parser arguments are provided                                      
    def check_options(self, opts):
        required_missing_fields = []

        if opts.outfile == None: required_missing_fields.append('outfile')

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

    def run(self):

        timestamp = int(time.time())
        print "Running TableMaintainer at %d" % (timestamp)

        sql_file = open(self._opts.outfile, 'wb')

        # Start a transaction
        sql_file.write('begin transaction;\n')

        # Loop over all maintained tables
        for table in maintained_tables:
            
            tablename = table['tablename']
            id_column = table['id_column']
            archive_tablename = "%s_ARCHIVE" % tablename
            window = int(self._opts.window)

            print "Maintaining table %s" % tablename

            # Make sure there is an empty archive table (copy of table)
            create_stmt = "create table if not exists %s (like %s)" % (archive_tablename, tablename)
            sql_file.write(create_stmt + ";\n");

            # Insert a record into table history
            insert_stmt = "insert into table_history (timestamp, max_id, tablename) " +\
                "values (%d, (select max(%s) from %s), '%s')" % \
                (timestamp, id_column, tablename, tablename);
            insert_stmt = "insert into table_history (timestamp, max_id, tablename) " +\
                "values (%d, (select max(%s) from %s), '%s')" %  \
                (timestamp, id_column, tablename, tablename);
            print "INSERT = %s" % insert_stmt
            sql_file.write(insert_stmt + ";\n");

            # Copy all rows with ID more than 24 hours old from data table into archive table
            copy_template = "insert into %s select * from %s where %s < " +\
                "(select max(max_id) from table_history where tablename = '%s' " + \
                "and timestamp = (select max(timestamp) from table_history " + \
                "where tablename = '%s' and timestamp < %d))"
            copy_stmt = copy_template % \
                (archive_tablename, tablename, id_column, tablename, tablename, (timestamp-window))
            sql_file.write(copy_stmt + ";\n");

            # Delete all rows with ID more than 24 hours old from data table
            delete_template = "delete from %s where %s < (select max(max_id) from table_history " + \
                "where tablename = '%s' and timestamp = (select max(timestamp) " + \
                "from table_history where tablename = '%s' and timestamp < %d))"
            delete_stmt = delete_template % \
                (tablename, id_column, tablename, tablename, (timestamp-window))
            sql_file.write(delete_stmt + ";\n");

        # Commit transaction
        sql_file.write("commit;\n");

        sql_file.close()

        # Invoke SQL file                                                                        
	sql_cmd = "PGPASSWORD=%s psql -U %s -h %s %s -f %s" % \
            (self._opts.dbpass, self._opts.dbuser, self._opts.dbhost,
             self._opts.dbname, self._opts.outfile)
        print "INVOKING CMD = %s" % sql_cmd
        os.system(sql_cmd)


def main():
    tbl_maint = TableMaintainer();
    while True:
        tbl_maint.run()
        frequency = int(tbl_maint._opts.frequency)
        time.sleep(frequency)

if __name__ == "__main__":
    sys.exit(main())

