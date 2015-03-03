Idle CPU Time
=============

{{{
widget:
  type: data/ec/line_chart
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
        WHERE c.oml_sender_id = s.id
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

widget:
  type: data/ec/line_chart
  caption: More CPU Utilization
  data_source:
    schema: [['oml_tuple_id', 'int'], ['sender'], ['ts', 'double'], ['user', 'double'], 
             ['sys', 'double'], ['idle', 'double']]
    database:
      query: 
        SELECT c.oml_tuple_id, s.name as sender, c.oml_ts_client as ts, 
          100 * c.user / c.total as user, 
          100 * c.sys / c.total as sys, 100 * c.idle / c.total as idle 
        FROM nmetrics_cpu as c, _senders as s 
        WHERE c.oml_sender_id = s.id
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
