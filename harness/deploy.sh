#!/bin/bash

# TODO: verify this is still working as intended, after the repo refactor..
rsync -rltgoDvP --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='.DS_Store' . /google/data/rw/users/rv/rviscomi/www/spike-test/
