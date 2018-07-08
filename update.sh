#!/bin/sh
git pull
yarn install --pure-lockfile
yarn clean
yarn build