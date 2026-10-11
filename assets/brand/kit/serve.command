#!/bin/bash
cd "$(dirname "$0")"
python3 -m http.server 4471 --bind 127.0.0.1 &
server=$!
sleep 0.4
open "http://127.0.0.1:4471/"
wait "$server"
