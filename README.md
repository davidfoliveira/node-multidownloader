# node-multidownloader

A command-line downloading app which can handle multiple downloads at the same time

## Installing

npm install -g multidownloader

## Using

	multidownloader [OPTIONS] http://url1/file1 http://url2/file2 ...

or

	multidownloader [OPTIONS] - ...


## Supported parameters

* -d | --destionation | --target - Sets the directory where the downloaded files should be stored

* -s NUM - Sets the number of maximum sockets for a given server (simultaneous downloads per server)

* -v - Activates the verbose mode

* -q - Quiet mode

* -p X - Periodically print the percentage of completed downloads (every X seconds)

* -r X - Retry X times downloading a file when it fails (low-level failures not HTTP >= 400)

* -R X - Wait X ms before a retry
