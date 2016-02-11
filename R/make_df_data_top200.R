library(dplyr)
library(tidyr)
load("data/df_data_resources.Rda")
load("data/df_data_reuses.Rda")
load("data/df_data_followers.Rda")
load("data/df_data.Rda")

df_data_top200 <- df_data %>% 
  left_join(df_data_resources, by = "dataset_id") %>% 
  left_join(df_data_reuses, by = "dataset_id") %>% 
  replace_na(list(reuses_n=0)) %>% 
  left_join(df_data_followers, by = "dataset_id")

save(df_data_top200, 
     file = "data/df_data_top200.Rda")

# df_data_top200 %>% 
#   mutate(followers_n_rank = rank(-followers_n, ties.method = "first")) %>% 
#   arrange(desc(followers_n)) %>%
#   View()
# 
# df_data_top200 %>% 
#   mutate(followers_n_rank = rank(-followers_n, ties.method = "first")) %>% 
#   arrange(desc(followers_n)) %>%
#   View()
# 
