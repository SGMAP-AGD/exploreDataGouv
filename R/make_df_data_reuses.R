## Calcul des réutilisations

library(dplyr)
library(stringr)
library(tidyr)

load("data/data.Rda")

df_tidy_reuses <- reuses %>% 
  select(id, title, datasets) %>%
  mutate(dataset_id = str_split(datasets, pattern = ",")) %>% 
  unnest(dataset_id) %>% 
  select(
    reuse_id = id, 
    reuse_title = title, 
    dataset_id
  )

df_data_reuses <- df_tidy_reuses %>% 
  group_by(dataset_id) %>% 
  dplyr::summarise(reuses_n = n())

save(df_data_reuses, 
     file = "data/df_data_reuses.Rda")
