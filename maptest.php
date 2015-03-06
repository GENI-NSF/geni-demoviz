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


?>
<!DOCTYPE HTML>
<html lang="en">
<meta charset="utf-8">
<head>

<script type="text/javascript" src="https://www.google.com/jsapi"></script>
<script src="https://maps.googleapis.com/maps/api/js?v=3.exp&signed_in=true"></script>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"></script>
<script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.10.4/jquery-ui.min.js"></script>

<script>

	google.maps.event.addDomListener(window, 'load', initialize);


function initialize() {
      $.getJSON('grab_visualization_data.php?base_name=lwtesting_stitchtest',
         function(data) {
	    drawMap(data);
        });
}

function getSiteById(site_id, data)
{
	for(var i = 0; i < data.sites.length; i++) {
	   var site = data.sites[i];
	   if(site.id == site_id)
	      return site;
	}
	return null;
}

function getCoordsForSiteId(site_id, data)
{
	var site = getSiteById(site_id, data);
        return new google.maps.LatLng(site.latitude, site.longitude);
}

function getCoordsForNodeId(node_id, data)
{
	for(var i = 0; i < data.nodes.length; i++) {
	    var node = data.nodes[i];
	    if(node.id == node_id) {
	        return getCoordsForSiteId(node.site_id, data);
	    }
        }
	return null;
}

function drawMap(data)
{

	 var mapOptions = {
    	 zoom: 4,
    	 center: new google.maps.LatLng(38, -98),
    	 mapTypeId: google.maps.MapTypeId.TERRAIN
	 };

	 var map = new google.maps.Map(document.getElementById('map-canvas'), 
	    mapOptions);

	 // Draw Nodes, with radius proportional to number of nodes at site
	 var site_counts = {};
	 for(var i = 0; i < data.nodes.length; i++) {
	    var node = data.nodes[i];
            var site_id = node.site_id;
	    if (!(site_id in site_counts)) {
	        site_counts[site_id] = 0;
            }
	    site_counts[site_id] = site_counts[site_id] + 1;
         }
         for(var site_id in site_counts) {
	    var site_count = site_counts[site_id];
	    var site_coords = getCoordsForSiteId(site_id, data);
	    var site_radius = 10000 * site_count;
	    siteOptions = {
	       strokeColor: 'black',
	       strokeOpacity: 0.8,
	       strokeWeight:  2,
	       fillColor: 'blue',
	       fillOpacity: 0.35,
	       map:map,
	       center: site_coords,
	       radius: site_radius
	    };
	    circle = new google.maps.Circle(siteOptions);
         }

	 // Draw links 
         for(var i = 0; i < data.links.length; i++) {
	    var link = data.links[i];
	    from_node_id = link.from_id;
	    to_node_id = link.to_id;
	    var pathCoords = [
	       getCoordsForNodeId(from_node_id, data),
	       getCoordsForNodeId(to_node_id, data)
            ];
	    var path = new google.maps.Polyline({
	      path: pathCoords,
	      geodesic: true,
	      strokeColor : 'green',
	      strokeOpacity: 1.0,
	      strokeWeight : 2
	    });
            path.setMap(map);
         }
}


</script>
</head>
<body style="font-family: Arial;border: 0 none;">
  <div id="map-canvas" style="width: 800px; height: 600px;"></div>
</body>
</html>

