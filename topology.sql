drop table if exists test_topology;
create table test_topology (
       id integer,
       name varchar,
       size integer,
       longitude double precision,
       latitude double precision,
       color  varchar
);

insert into test_topology (id, name, size, longitude, latitude, color) values
(1, 'IG-GPO', 42.37, -71.11, 3, 'red');
insert into test_topology (id, name, size, longitude, latitude, color) values
(2, 'IG-UTAH', 40.75, -111.88, 1, 'grey');
insert into test_topology (id, name, size, longitude, latitude, color) values
(3, 'OG-CLEMSON', 34.68, -82.81, 5, 'green');

