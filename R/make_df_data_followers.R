library(jsonlite)
library(dplyr)
library(magrittr)
library(plyr)
load("data/df_data.Rda")

get_total_followers <- function(id) {
  api <- "https://www.data.gouv.fr/api/1/datasets/"
  list_followers <- fromJSON(
    txt = paste0(api,id,"/followers/"))
  total = list_followers$total
  return(data.frame(dataset_id = id, followers_n = total, 
                    stringsAsFactors = FALSE))
}

get_total_followers(id = "558837cfc751df7991a453bc")

df_data_followers <- ldply(df_data$dataset_id,
                            get_total_followers, 
                            .progress = "text")

save(df_data_followers, 
     file = "data/df_data_followers.Rda")




