create table XXX_node (
       id serial primary key,
       site_id integer,
       name varchar,
       client_id varchar,
       zoom_level integer,
       status varchar,
       sender varchar
);

create table XXX_link (
       id serial primary key,
       from_id integer,
       from_if_name varchar,
       to_id integer,
       to_if_name varchar,
       status varchar,
       link_id varchar
);

