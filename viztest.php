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
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"></script>
<script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.10.4/jquery-ui.min.js"></script>

<script>

	 google.load('visualization', '1.0');
	 google.setOnLoadCallback(loadData);


function loadData()
{
      $.getJSON('grab_visualization_data.php?base_name=lwtesting_stitchtest',
         function(data) {
	    drawData(data);
        });
}

function drawData(data)
{

      var data_table = [];
      data_table.push(["ID", "NAME", "URN", "LOCATION"]);
      for(var i = 0; i < data.sites.length; i++) {
         var site = data.sites[i];
	 var site_data = [site.id, site.am_name, site.am_urn, 
	       site.longitude + ", " + site.latitude];
	 data_table.push(site_data);
      }
      
      var wrapper = new google.visualization.ChartWrapper({
            chartType: 'Table',
	    dataTable : data_table,
	    options: {'title': 'Sites'},
	    containerId : 'vis_div'
         });
         wrapper.draw();
}

</script>
</head>
<body style="font-family: Arial;border: 0 none;">
  <div id="vis_div" style="width: 800px; height: 600px;"></div>
</body>
</html>


