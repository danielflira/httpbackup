httpbackup
==========

http api to backup files, service store files by sha512 so all copies are stored as one file.

Backup
------

$ curl -X POST http://localhost:3000/store/path/of/file1 --data-binary "file 1 content"
$ curl -X POST http://localhost:3000/store/path/of/file2 --data-binary "file 2 content"

Retrive
-------

$ curl -X GET http://localhost:3000/store/path/of/file1
$ curl -X GET http://localhost:3000/store/path/of/file2

Metadata
--------

$ curl -sX GET http://localhost:3000/meta/path/of/file1 | python3 -m json.tool
$ curl -sX GET http://localhost:3000/meta/path/of/file2 | python3 -m json.tool

Backup all files
================

$ find ~/Downloads | xargs -I {} curl -X POST http://localhost:3000/store/supermachine/{} --data-binary @{}
