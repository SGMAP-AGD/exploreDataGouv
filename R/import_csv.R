library("readr")

## Datasets
download.file(url = "https://www.data.gouv.fr/fr/datasets.csv?sort=-created",
              destfile = "data/datasets.csv")
datasets <- read_csv2("data/datasets.csv")

## Resources
download.file(url = "https://www.data.gouv.fr/fr/resources.csv?",
              destfile = "data/resources.csv")
resources <- read_csv2("data/resources.csv")

## Reuses
download.file(url = "https://www.data.gouv.fr/fr/reuses.csv?sort=-created",
              destfile = "data/reuses.csv")
reuses <- read_csv2("data/reuses.csv")

## Organizations
download.file(url = "https://www.data.gouv.fr/fr/organizations.csv?",
              destfile = "data/organizations.csv")
organizations <- read_csv2("data/organizations.csv")

## Sauvegarde
save(datasets, resources, reuses, organizations, 
     file = "data/data.Rda")
