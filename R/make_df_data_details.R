library(jsonlite)
library(dplyr)
library(magrittr)
library(plyr)
load("data/df_data.Rda")

get_data_details <- function(id) {
  api <- "https://www.data.gouv.fr/api/1/datasets/"
  full <- fromJSON(
    txt = paste0(api,id,"/full/")
    )
  return(
    data.frame(
      dataset_id = id,
      date_creation = full$created_at, 
      quality_score = full$quality$score, 
      stringsAsFactors = FALSE
      )
    )
}


#get_data_details(id = "53698f6ea3a729239d203747")

df_data_details <- ldply(df_data$dataset_id,
                           get_data_details, 
                           .progress = "text")

save(df_data_details, 
     file = "data/df_data_details.Rda")
