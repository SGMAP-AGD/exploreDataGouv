library(dplyr)
load("data/data.Rda")

df_data <- resources %>% 
  distinct(dataset.id) %>% 
  select(
    dataset_id = dataset.id, 
    dataset_title = dataset.title, 
    dataset_slug = dataset.slug, 
    organization = dataset.organization,
    organization_id = dataset.organization_id, 
    dataset_license = dataset.license
    ) 

save(df_data, file = "data/df_data.Rda")
