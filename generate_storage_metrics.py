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

# Script to generate storage metrics (% used) of a given disk filesystem 
# and write these to a database
# GEC22 demo visualizations                                                                      

from generate_metrics import MetricGenerator
import time;
import optparse
import os
import subprocess
import sys

# Class to grab storage usage
class StorageMetricGenerator(MetricGenerator):

    def __init__(self):
        MetricGenerator.__init__(self)

    # Add options to parser                                                                      
    def add_parser_options(self, parser):
        MetricGenerator.add_parser_options(self, parser)
        parser.add_option('--file_root', help="Name of disk file root", default="/")

    # Set of metrics by name
    def getMetricNames(self):
        return ["used_storage", "free_storage"]

    # Set of metrics by value
    def getMetricValues(self):
        st = os.statvfs(self._opts.file_root)        
        free = (st.f_bavail * st.f_frsize)
        total = (st.f_blocks * st.f_frsize)
        used = (st.f_blocks - st.f_bfree) * st.f_frsize
        try:
            percent_used = ret = (float(used) / total) * 100
        except:
            percent_used = 0
        percent_used = int(percent_used)
        return [percent_used, 100-percent_used]


# Run indefinitely, only adding new rows                                                         
def main():
    smg = StorageMetricGenerator()
    while True:
        frequency = int(smg._opts.frequency)
        smg.run()
        time.sleep(frequency)




if __name__ == "__main__":
    sys.exit(main())

