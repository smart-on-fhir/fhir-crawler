# FHIR Crawler
The FHIR Crawler is a Node.js package that allows you to crawl and extract data
from FHIR servers. It is designed to be flexible and configurable alternative to
FHIR Bulk Data exports, and can handle large volumes of data.

## Prerequisites
Docker or NodeJS 16+ and Git

## Installation
You don't need to install anything if you plan to use the Docker version. Otherwise do:
```sh
git clone https://github.com/smart-on-fhir/fhir-crawler.git
cd fhir-crawler
npm i
```

## Configuration

First you will need to choose a folder to work with. It will contain your configuration, as well as the downloaded data. We call that the "**volume**" folder. You will pass the path to this folder as an argument when you run the script.

*<b style="color:#F00">Warning:</b> The volume folder will contain configuration secrets as well as  downloaded PHI! Please make sure it is protected. Do not create a folder within the project,
or any other git-controlled directory to make sure that PHI will not end up in git history
and that it will not be pushed to any remote repository.*

Before using this tool, a configuration file named `config.js` must be created in the "volume" folder described above. An easy way to start is to make a copy of the provided [example](./example-config.js):
```sh
cp example-config.js my/folder/config.js
```
Then edit that config file and enter your settings. Read the comments in the
file for further details about each option.

## Migration to v2
1. In v1 the config file could have any name. The path to it was given to the script
   via `-c` parameter. In v2 that file **must** be called `config.js`, so start by renaming it.
2. The config file is now `.js` instead of `.ts`. To switch:
   - Remove type imports like `import { Config } from "../src/types"`
   - Switch to CommonJS exports. For example, use `module.exports = { ... }` instead
     of `export default { ... }`
3. The example config file is now converted to JS so you can see the difference
4. Pick (or create) a "volume" folder. The script will load config from there. It will
   also write output files to it.
5. Place/move your `config.js` file into that "volume" folder.
6. That should be it. Run it with
   - Direct: `npm start -- -p /path/to/volume/`
   - Docker: `docker run -v /path/to/volume/:/app/volume/ smartonfhir/fhir-crawler`

## Usage
1. Running it directly
  `cd` into the `fhir-crawler` folder and run:
   ```sh
   # /path/to/volume/ is the folder containing your config file. It will also receive the downloaded data
   npm start -- -p /path/to/volume/
   ```
2. Running it with Docker
   ```sh
   # /path/to/volume/ is the folder containing your config file. It will also receive the downloaded data
   docker run -it -v /path/to/volume/:/app/volume/ smartonfhir/fhir-crawler
   ```

## Skipping the patient bulk-data export
This script does two major things. First it downloads all the patients in a given group
using Bulk Data Group export, then it download the specified resources associated with
these patients using a standard FHIR API calls. In some cases people may need to re-run
the crawler but skip the patient download part. To achieve this do the following:
1. After successful export locate the patient files. There should be one or more files with
   names like `1.Patient.ndson` at `/path/to/volume/output/`.
2. Copy those patient files one level up outside of that `output` folder (because everything in `output`
   will be deleted before every run)
3. On the next run pass the patient file names as `--patients` argument. Example:
   ```
   npm start -- -p /path/to/volume/ --patients 1.Patient.ndson --patients 2.Patient.ndson
   ```
   You can do the same using Docker:
   ```
   docker run -it -v /path/to/volume/:/app/volume/ smartonfhir/fhir-crawler --patients 1.Patient.ndjson
   ```


## Logs
The script will display some basic stats in the terminal, and will also generate 
two log files within the output folder (where the NDJSON files are downloaded):
- `error_log.txt` contains any errors encountered while exporting data. Those errors are
  more or less unpredictable, thus the log is in plain text format.
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


<!--
Docker maintainer notes
--------------------------------------------------------------------------------
Build:
docker build -t smartonfhir/fhir-crawler:latest .

Push:
docker push smartonfhir/fhir-crawler:latest

Test:
docker run -v /path/to/host/dir:/app/volume smartonfhir/fhir-crawler
--------------------------------------------------------------------------------
-->





