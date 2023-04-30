# fhir-crawler
Utility do download resources from a FHIR server

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