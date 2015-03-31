1. Allocate a server

Use an RSPEC for a beefier host than the default. For example, 4
cores, 4096 ram, 40 GB disk. The file "visualization-rspec.xml" in
this directory provides a sample.

Make sure to specify publicly routable IP address in Jacks.

Once it is up, run

sudo bash
/usr/testbed/bin/mkextrafs /mnt
exit


2. Install packages.

sudo sh -c "echo 'deb http://download.opensuse.org/repositories/devel:/tools:/mytestbed:/stable/xUbuntu_12.04/ /' >> /etc/apt/sources.list.d/oml2.list"
sudo apt-get update
sudo apt-get install apache2 php5
sudo apt-get install oml2 postgresql-9.1 postgresql-client-9.1
sudo apt-get install python-sqlalchemy python-psycopg2 php5-pgsql


3. Install GCF (optional)

sudo apt-get install python-m2crypto python-dateutil python-openssl libxmlsec1 xmlsec1 libxmlsec1-openssl libxmlsec1-dev
wget ...
tar xvfg ....


4. Create the database

sudo su postgres
createuser -U postgres --pwprompt --no-superuser --createdb --no-createrole oml2
[It will prompt you for the oml2 user name twice - 0mlisg00d4u]
psql
postgres=# create database gec22;
^d
exit


5. Import the database

# Copy datagase dump onto machine possibly unzipping
#
# One is stored at www.gpolab.bbn.com:/home/tmitchel/GEC22
psql -U oml2 -h localhost gec22 < $dumpfile


6. Install the server S/W

sudo mkdir /var/www/html
sudo mkdir /var/www/common
sudo chmod a+rw /var/www/html
sudo chmod a+rw /var/www/common
[Remote] scp *.css *.html *.php *.js $SERVER_IP:/var/www/html
[Remote] scp common/* $SERVER_IP:/var/www/common


7. Set up the oml server

Edit the OPTS line in /etc/default/oml2-server to reflect the database
parameters:

OPTS="$OPTS --backend postgresql --pg-host=localhost --pg-port=5432 --pg-user=oml22 --pg-pass=0mlisg00d4u"

sudo service oml2-server restart


8. Upgrade the shared memory

Add this line to the end of /etc/default/sysctl.conf

kernel.shmmax = 1000000000

Then

sudo sysctl -p


9. Configure Apache

edit /etc/php5/apachd2/php.ini
Add this line after [postgreSQL]
extension=php_pgsql.dll

sudo service apache2 restart
