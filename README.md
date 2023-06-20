# FHIR Crawler
The FHIR Crawler is a Node.js package that allows you to crawl and extract data
from FHIR servers. It is designed to be flexible and configurable alternative to
FHIR Bulk Data exports, and can handle large volumes of data.

## Prerequisites
NodeJS 16+ and Git

## Installation
```sh
git clone https://github.com/smart-on-fhir/fhir-crawler.git
cd fhir-crawler
npm i
```

## Configuration
Before using this tool, a configuration file must be created. An easy way to start
is to make a copy of the provided [example](./config/example-config.ts):
```sh
cp config/example-config.ts config/config.ts
```
Then edit that config file and enter your settings. Read the comments in the
file for further details about each option.

Note that for convenience every file in the `config` folder is already ignored
by git and you don't need to worry about accidentally committing your secrets.

*<b style="color:#F00">Warning:</b> The `destination` option can be dangerous!
By default, the script will delete all the `.ndjson` or `manifest.json` files
found in the specified destination directory prior to execution. It will also
empty any previous log files found there. If you specify a directory that contains
important data, it will be permanently deleted without any prompt or confirmation.
It is important to use caution when specifying the `destination` option to avoid data loss.*


## Usage
`cd` into the `fhir-crawler` folder and run:
```sh
npm start -- -c path/to/my/config.ts
```

## Logs
The script will display some basic stats in the terminal, and will also generate 
two log files within the output folder (where the NDJSON files are downloaded):
- `error_log.txt` contains any errors encountered while exporting data. Those errors are
  more or less unoredictable, thus the log is in plain text format.
- `request_log.tsv` contains information about HTTP requests and responses.
  These logs have a predictable structure so the TSV format was chosen to make them
  easier to consume by both humans and spreadsheet apps.

## Contributing
Contributions to the FHIR Crawler project are welcome and encouraged! If you find
a bug or have a feature request, please open an issue on the project's GitHub page.
If you want to contribute code, please fork the project, create a new branch for
your changes, and submit a pull request when you're ready.

Before submitting a pull request, please make sure that your code passes the
project's tests by running npm test.

## License
The FHIR Crawler is licensed under the Apache License, Version 2.0. See the
LICENSE file for more information.






