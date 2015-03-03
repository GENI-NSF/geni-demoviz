Network
=============

{{{
widget:
  type: data/ec/line_chart
  caption: Network Utilization
  data_source:
    schema: [['oml_tuple_id', 'int'], ['sender'], ['ts', 'double'], ['rx_bytes', 'double'], 
       ['tx_bytes', 'double']]
    database:
      query: 
        SELECT c.oml_tuple_id, s.name as sender, c.oml_ts_client as ts, 
          c.rx_bytes, 
	  c.tx_bytes
        FROM nmetrics_network as c, _senders as s 
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
