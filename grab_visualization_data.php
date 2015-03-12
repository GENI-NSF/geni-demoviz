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

// Script to return information about a given topology indicated by 
// a given table name. We look in 
// allsites: all sites known to exist
// <basename>_nodes: all nodes of the topology
// <basename>_links: all links of the topology

// Get information about all sites (aggregates typically)
function get_aggregate_info()
{
    $query = "select id, am_name, am_urn, longitude, latitude from allsites";
    return get_rows_for_query($query);
}

// Get information about nodes in this slice/experiment
function get_node_info($table_base)
{
    $table_name = $table_base . "_node";
    $query = "select id, site_id, name, client_id, zoom_level, status, sender from $table_name";
    return get_rows_for_query($query);
}

// Get information about links in this slice/experiment
function get_link_info($table_base)
{
    $table_name = $table_base . "_link";
    $query = "select id, from_id, from_if_name, to_id, to_if_name, status, link_id from $table_name";
    return get_rows_for_query($query);
}

// Required arguments in $_GET (on URL PUT)
//    slice_urn

// error_log("GET = " . print_r($_GET, true));

$slice_name = NULL;
$project_name = NULL;
$base_name = NULL;

// We can specify our request by project/slice or base_name
if(array_key_exists('slice_name', $_GET)) {
  $slice_name = $_GET['slice_name'];
}

if(array_key_exists('project_name', $_GET)) {
  $project_name = $_GET['project_name'];
}

if(array_key_exists('base_name', $_GET)) {
  $base_name = $_GET['base_name'];
}

if($base_name == NULL) {
   if(($slice_name == NULL) || ($project_name == NULL)) {
      error_log("Must provide either base_name or slice_name and project_name");
      exit;
   } else {
      $base_name = strtolower($project_name) . "_" . strtolower($slice_name);
   }  
}

$ch = "ch.geni.net";
$slice_urn = "urn:publicid:IDN+$ch+$project_name+slice+$slice_name";

// echo "Hello from $slice_urn";

// Get entries in sliver_info for this URN

// Get aggregate info
$agg_info = get_aggregate_info();
//error_log("AGGS = " . print_r($agg_info, true));

// Get node info
$node_info = get_node_info($base_name);
//error_log("NODES = " . print_r($node_info, true));

// Get link info
$link_info = get_link_info($base_name);
//error_log("LINKS = " . print_r($link_info, true));

// Top level code: Get the sites/nodes/links data
// and return as JSON
$data = array('sites' => $agg_info, 
      'nodes' => $node_info, 
      'links' => $link_info);
print json_encode($data);


?>

