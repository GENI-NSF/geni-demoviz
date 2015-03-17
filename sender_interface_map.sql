begin transaction;
drop table if exists sender_interface_map;
create table sender_interface_map as
select distinct oml_sender_id as sender, name as interface
from nmetrics_network;
commit;

