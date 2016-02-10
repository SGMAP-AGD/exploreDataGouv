# Calcul du nombre de téléchargements par jeu de données
library(dplyr)
load("data/data.Rda")
df_data_resources <- resources %>% 
  group_by(dataset.id) %>% 
  dplyr::summarise(
    resources_n = n(), 
    resources_sum_downloads = sum(downloads)
  ) %>% 
  ungroup() %>% 
  select(
    dataset_id = dataset.id, 
    resources_n, 
    resources_sum_downloads
  )

save(df_data_resources, file = "data/df_data_resources.Rda")
