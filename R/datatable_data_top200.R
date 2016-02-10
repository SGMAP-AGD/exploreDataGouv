library(DT)
library(htmlwidgets)
library(dplyr)
load("data/df_data_top200.Rda")

dt_data_top200 <- df_data_top200 %>%
    select(dataset_title, organization, 
           resources_sum_downloads, reuses_n, followers_n) %>% 
    datatable(., 
              rownames = FALSE, 
              options = list(
                pageLength = 10
              ))

saveWidget(dt_data_top200, 
           file = "~/Documents/projets/exploreDataGouv/output/dt_data_top200.html", 
           selfcontained = TRUE,
           background = "white")
