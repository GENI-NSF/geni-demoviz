#!/usr/bin/env python
#----------------------------------------------------------------------
# Copyright (c) 2015 Raytheon BBN Technologies
#
# Permission is hereby granted, free of charge, to any person obtaining
# a copy of this software and/or hardware specification (the "Work") to
# deal in the Work without restriction, including without limitation the
# rights to use, copy, modify, merge, publish, distribute, sublicense,
# and/or sell copies of the Work, and to permit persons to whom the Work
# is furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be
# included in all copies or substantial portions of the Work.
#
# THE WORK IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
# OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
# HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
# WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE WORK OR THE USE OR OTHER DEALINGS
# IN THE WORK.
#----------------------------------------------------------------------

#----------------------------------------------------------------------
#
# This program turns domain names into lat/lon points and outputs a
# JSON file suitable for use with genisites.js. The conversion uses a
# geoip2 package and associated database.
#
# INSTALL
# =======
#
# yum install python-pip
# pip install geoip2
# wget http://geolite.maxmind.com/download/geoip/database/GeoLite2-City.mmdb.gz
# gunzip GeoLite2-City.mmdb.gz
#
# SAMPLE
# ======
# 
#   import socket
#   import geoip2.database
#   reader = geoip2.database.Reader('GeoLite2-City.mmdb')
#   ipaddr = socket.gethostbyname('uvm.edu')
#   x = reader.city(ipaddr)
#   x.location.latitude
#   x.location.longitude
#
#
# DOMAIN DATA
# ===========
#
# Domain data is extracted from the Member Authority database in CSV
# format for input into this program. The PostgreSQL command needs to
# be on one line for the \copy command to work:
#
#  -- Select eppn and email for all users.
#  -- This all needs to be on one line to work.
#  \copy (select mma1.value as eppn, mma2.value as email from ma_member_attribute mma1, ma_member_attribute mma2 where mma1.member_id = mma2.member_id and mma1.name = 'eppn' and mma2.name = 'email_address') To '/tmp/eppn-email.csv' with CSV
#
#
# USAGE
# =====
#
#  geocode.py > genisites.json
#
# NOTE: requires file "eppn-email.csv" in the current working directory
#
#----------------------------------------------------------------------

from __future__ import print_function

from collections import defaultdict
import json
import socket
import sys

import geoip2.database

eppn_domains = defaultdict(int)
email_domains = defaultdict(int)

def process_email(x):
    parts = x.split('@')
    if len(parts) != 2:
        print('error: %r' % (x), file=sys.stderr)
    else:
        domain = parts[1]
        rev_domain = domain.split('.')
        rev_domain.reverse()
        if rev_domain[0] in ['edu', 'gr', 'br', 'de', 'it', 'kr']:
            # limit these domains to the top level
            rev_domain = rev_domain[:2]
        if rev_domain[-1] in ['student', 'students']:
            # remove this leading subdomain
            rev_domain = rev_domain[:-1]
        rev_domain.reverse()
        domain = '.'.join(rev_domain)
        email_domains[domain] = email_domains[domain] + 1

def process_eppn(x):
    parts = x.split('@')
    if len(parts) != 2:
        pass
    else:
        domain = parts[1]
        eppn_domains[domain] = eppn_domains[domain] + 1

def process_line(x):
    (eppn, email) = x.split(',')
    eppn = eppn.strip().lower()
    email = email.strip().lower()
    if 'gpolab.bbn.com' in eppn:
        process_email(email)
    else:
        process_eppn(eppn)

with open('eppn-email.csv') as f:
    for line in f:
        process_line(line)

# combine email and eppn domains
for d in sorted(email_domains):
    eppn_domains[d] = eppn_domains[d] + email_domains[d]

#for d in eppn_domains:
#    print d, eppn_domains[d]

def make_site(domain, geodata, count):
    return dict(name=domain,
                count=count,
                latitude=geodata.location.latitude,
                longitude=geodata.location.longitude,
                country=geodata.country.iso_code)

reader = geoip2.database.Reader('GeoLite2-City.mmdb')
domains = []
for d in eppn_domains:
    try:
        ipaddr = socket.gethostbyname(d)
        x = reader.city(ipaddr)
        domains.append(make_site(d, x, eppn_domains[d]))
    except:
        d2 = 'www.' + d
        try:
            ipaddr = socket.gethostbyname(d2)
            x = reader.city(ipaddr)
            domains.append(make_site(d, x, eppn_domains[d]))
        except:
            msg = "DNS FAILURE: %s, %s (count=%d)" % (d, d2, eppn_domains[d])
            print(msg, file=sys.stderr)
        
msg = "Found locations for %d domains" % (len(domains))
print(msg, file=sys.stderr)
print(json.dumps(domains))
