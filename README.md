# IPFS Bucket Tree

This is a simple data store built on the IPFS DAG. It allows you to store
buffers in a "directory" tree. The buffers you store do not have keys, are
unordered, and cannot be inserted twice.

The initial use case for this storage system was to have a *lightly* indexed
way to store [gharchive](https://www.gharchive.org/) data in IPFS.

Read performance is often sacrificed for write performance of
large datasets.

Values are compressed with gzip.

## API

`store.ls(path)` returns an async iterable that iterates gives every file
in the bucket.
`store.put(...paths, buffer)` insert the buffer into the give path(s).