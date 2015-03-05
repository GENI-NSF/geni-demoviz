Site Map Test
=============

{{{

widget:
  type: data/map_l
  caption: Site Status
  data_sources:
    nodes:
      schema: [['id', 'int'], ['name'], ['site_id', 'int'], ['site_name'], ['status'], 
               ['lat', 'float'], ['lon', 'float']]
      database:
        query: SELECT n.id, n.client_id as name, s.id as site_id, s.am_name as site_name, 
               n.status, s.latitude as lat, s.longitude as lon 
               FROM LWTesting_StitchTest_node as n, allsites as s WHERE n.site_id = s.id
        peg_offset: true # resend entire node status every few seconds
        mode: update
        check_interval: 4
        url: postgres://oml2:0mlisg00d4u@155.99.144.110:5432/gec22

    links:
      schema: [['id', 'int'], ['from_id', 'int'], ['from_if_name'], ['to_id', 'int'], 
        ['to_if_name'], ['status'], ['link_id'], ['from_site_id', 'int'], ['to_site_id', 'int']]
      database:
        query: SELECT l.*, fn.site_id as from_site_id, tn.site_id as to_site_id 
               FROM LWTesting_StitchTest_link as l, LWTesting_StitchTest_node as fn, LWTesting_StitchTest_node as tn 
               WHERE l.from_id = fn.id AND l.to_id = tn.id
        peg_offset: true # resend entire node status every few seconds
        mode: update
        check_interval: 4
        url: postgres://oml2:0mlisg00d4u@155.99.144.110:5432/gec22

  width: 1.0
  hide_site_internals: {to: 6} # visible from and including 6
  map:
    center: [-98.0, 35.0]
    zoom: 4
    grayscale: true
    tile_provider: esri_world_topo
  mapping:
    nodes:
      id: id
      site: site_id # identify site
      status: status
      latitude:
        property: lat
      longitude:
        property: lon
      radius: 10
      fill_color:
        property: status
        color:
          unknown: gray
          down: lightblue
          up: green
          error: red
    links:
      from: from_id
      to: to_id
      from_site: from_site_id # identify site
      to_site: to_site_id
      stroke_color:
        property: status
        color:
          unknown: gray
          down: orange
          up: green
          error: red
      stroke_width: 4
      
}}}
Idle CPU Time
=============

{{{
widget:
  type: data/line_chart3
  caption: CPU Utilization
  data_source:
    schema: [['oml_tuple_id', 'int'], ['sender'], ['ts', 'double'], ['user', 'double'], 
             ['sys', 'double'], ['idle', 'double']]
    database:
      query: 
        SELECT c.oml_tuple_id, s.name as sender, c.oml_ts_client as ts, 
          100 * c.user / c.total as user, 
          100 * c.sys / c.total as sys, 100 * c.idle / c.total as idle 
        FROM nmetrics_cpu as c, _senders as s 
        WHERE c.oml_sender_id in (2, 3, 1) and c.oml_sender_id = s.id
      offset: -1000
      check_interval: 4
      url: postgres://oml2:0mlisg00d4u@155.99.144.110:5432/gec22
  mapping:
    x_axis:
      property: ts
    y_axis:
      property: idle
    group_by: sender
  axis:
    x:
      legend: Time (sec)
    y:
      legend: "%"
      ticks:
        format: ".1f"
}}}
Memory Activity
=============

{{{
widget:
  type: data/line_chart3
  caption: Memory Utilization
  data_source:
    schema: [['oml_tuple_id', 'int'], ['sender'], ['ts', 'double'], ['used', 'double'], 
       ['free', 'double'], ['actual_used', 'double'], ['actual_free', 'double']]
    database:
      query: | 
        SELECT c.oml_tuple_id, s.name as sender, c.oml_ts_client as ts, 
          100 * c.used / c.total as used, 
          100 * c.free / c.total as free, 
          100 * c.actual_used / c.total as actual_used,
          100 * c.actual_free / c.total as actual_free
        FROM nmetrics_memory as c, _senders as s 
        WHERE c.oml_sender_id in (2, 3, 1) and c.oml_sender_id = s.id
      offset: -1000
      check_interval: 4
      url: postgres://oml2:0mlisg00d4u@155.99.144.110:5432/gec22
  mapping:
    x_axis:
      property: ts
    y_axis:
      property: actual_used
    group_by: sender
  axis:
    x:
      legend: Time (sec)
    y:
      legend: "%"
      ticks:
        format: ".1f"
}}}
Network Activity
=============

{{{
widget:
  type: data/line_chart3
  caption: Network Utilization
  data_source:
    schema: [['oml_tuple_id', 'int'], ['sender'], ['ts', 'double'], 
      ['rx_bytes', 'double'], ['tx_bytes', 'double']]
    database:
      query: |
        SELECT c.oml_tuple_id, s.name as sender, c.oml_ts_client as ts, 
          c.rx_bytes, 
          c.tx_bytes
        FROM nmetrics_network as c, _senders as s 
        WHERE c.oml_sender_id in (2, 3, 1)  and c.oml_sender_id = s.id
      offset: -1000
      check_interval: 4
      url: postgres://oml2:0mlisg00d4u@155.99.144.110:5432/gec22
  mapping:
    x_axis:
      property: ts
    y_axis:
      property: rx_bytes
    group_by: sender
  axis:
    x:
      legend: Time (sec)
    y:
      legend: "%"
      ticks:
        format: ".1f"
}}}
