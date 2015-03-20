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

include "db_utils.php";

// A script to read metrics data (memory, cpu, network)
// from the nmetrics_<data_type> tables

// *** TO DO: Make the timespan clause a variable ***

// error_log("GET = " . print_r($_GET, true));

// A sender is a unique identifier of who is sending the data
// Typically it is one per node
// So we can select only data for certain senders optionally
$senders_clause = "";
if(array_key_exists('senders', $_GET)) {
   $senders = $_GET['senders'];
   $senders_clause = "oml_sender_id in ($senders)";
}

$data_type = 'cpu';

if(array_key_exists('data_type', $_GET)) {
  $data_type = $_GET['data_type'];
}

$seconds = 120;
if(array_key_exists('seconds', $_GET)) {
  $seconds = $_GET['seconds'];
}

// Check if this is one of the recognized data types
if($data_type != 'cpu' && $data_type != 'memory' && $data_type != 'network') {
      error_log("Unrecognized data type: " . $data_type);
      exit;
}

// Get CPU data from the database
function get_cpu_data($seconds=null)
{
   return get_metrics_data('c.user/100 as user, c.sys/100 as sys, c.idle/100 as idle', 
			   'nmetrics_cpu', $seconds);
}

// Get Memory data from the database
function get_memory_data($seconds=null)
{
   return get_metrics_data('100*c.used/c.total as used, 100*c.free/c.total as free, ' . 
   '100*c.actual_used/c.total as actual_used, 100*c.actual_free/c.total as actual_free',
			   'nmetrics_memory', $seconds);
}

// Get network data from the database
function get_network_data($seconds=null)
{
  return get_metrics_data('c.rx_bytes, c.tx_bytes, c.name', 'nmetrics_network', $seconds);
}

// A timespan clause causes us to only get the most recent data (N seconds)
function get_timespan_clause($tablename, $seconds=null)
{
    global $senders_clause;
    if (is_null($seconds)) {
      $seconds = 120;
    }
    $qualifier = "";
    if ($senders_clause != "") $qualifier = " WHERE $senders_clause";
    return "(oml_ts_client + $seconds) > (select max(oml_ts_client) from $tablename $qualifier)";
}

// Get all the data for the given query 
// (which data, fields from which table with which timespan)
function get_metrics_data($fields, $tablename, $seconds=null)
{
   global $senders_clause;
   $timespan_clause = get_timespan_clause($tablename, $seconds);
   $query = "select c.oml_sender_id, s.name as sender, c.oml_ts_client as ts, " . 
   "$fields from $tablename as c, _senders as s where $timespan_clause and c.oml_sender_id = s.id";
   if ($senders_clause != "")
      $query = $query . " AND $senders_clause";
    $order_clause = "order by c.oml_ts_client";
    $query = $query . " " . $order_clause;
   return get_rows_for_query($query);
}

$data = array();

// Top level code: grab the right data and return as JSON
if ($data_type == 'cpu')
   $data= get_cpu_data($seconds);
else if ($data_type == 'memory')
   $data = get_memory_data($seconds);
else
   $data = get_network_data($seconds);

print json_encode($data);


?>
