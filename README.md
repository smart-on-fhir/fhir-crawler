# FHIR Crawler
The FHIR Crawler is a Node.js package that allows you to crawl and extract data
from FHIR servers. It is designed to be flexible and configurable alternative to
FHIR Bulk Data exports, and can handle large volumes of data.

## Prerequisites
NodeJS 18 and Git

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

## Usage
`cd` into the `fhir-crawler` folder and run:
```sh
npm start -- -c path/to/my/config.ts
```

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






