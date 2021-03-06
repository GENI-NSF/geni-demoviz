Memory
=============

{{{
widget:
  type: data/ec/line_chart
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
        WHERE c.oml_sender_id = s.id
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
