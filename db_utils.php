<?php
//----------------------------------------------------------------------        
// Copyright (c) 2012-2015 Raytheon BBN Technologies                            
//                                                                              
// Permission is hereby granted, free of charge, to any person obtaining        
// a copy of this software and/or hardware specification (the "Work") to        
// deal in the Work without restriction, including without limitation the       
// rights to use, copy, modify, merge, publish, distribute, sublicense,         
// and/or sell copies of the Work, and to permit persons to whom the Work       
// is furnished to do so, subject to the following conditions:                  
//                                                                              
// The above copyright notice and this permission notice shall be               
// included in all copies or substantial portions of the Work.                  
//                                                                              
// THE WORK IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS          
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF                   
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND                        
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT                  
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,                 
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,           
// OUT OF OR IN CONNECTION WITH THE WORK OR THE USE OR OTHER DEALINGS           
// IN THE WORK.                                                                 
//----------------------------------------------------------------------        

// Get a connection to the GEC22 visualizaiton database
// Probably should read this out of a config file
function get_connection()
{
    $dbuser = "oml2";
    $dbpass = "0mlisg00d4u";
    $dbhost = "155.99.144.115";
    $dbhost = "localhost";
    $dbport = "5432";
    $dbname = "gec22";
    $dbconn = pg_connect("host=$dbhost user=$dbuser dbname=$dbname password=$dbpass");
    return $dbconn;
}

// Grab all rows for a given query and return a list of 
// associative arrays, one per row
function get_rows_for_query($query)
{
    $rows = array();
    $dbconn = get_connection();
    $result = pg_query($dbconn, $query);
    if (!$result) {
      $pg_error = pg_last_error($dbconn);
       error_log("Failure on query: $query");
       error_log("ERROR = $pg_error");
       // Better to signal an error to the caller and let it decide
       // what the right response should be.
       header('HTTP/1.1 404 Not Found');
       exit;
    }
    while($row = pg_fetch_assoc($result)) {
//      error_log("row = " . print_r($row, true));
      $rows[] = $row;
    }
    pg_close($dbconn);
    return $rows;

}

?>
