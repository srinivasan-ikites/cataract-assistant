python -m ingestion.fetch_sources --only aao-what-are-cataracts aao-cataracts-iol-implants aao-cataract-qa-index --qa-limit 5"



# default behavior: read config, save to data/raw/html, fetch all QA pages
python ingestion/fetch_sources.py

# only fetch two specific sources and limit QA pages to 10
python ingestion/fetch_sources.py --only aao-cataract-qa-index aao-what-are-cataracts --qa-limit 10

# use a different YAML and output directory, more verbose logging
python ingestion/fetch_sources.py --config=config/my_sources.yaml --output-dir=data/snapshots --log-level=DEBUG



<!-- 2nd -->

python -m ingestion.parse_sources --only aao-what-are-cataracts aao-cataracts-iol-implants --qa-limit 5

<!-- 3 rd -->
python -m ingestion.normalize_records --log-level INFO"