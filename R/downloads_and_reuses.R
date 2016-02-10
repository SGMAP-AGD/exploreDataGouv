library(magrittr)
library(dplyr)
library(tidyr)
library(ggthemes)
library(ggplot2)
library(htmlwidgets)
library(tricky)
library(stringr)
library(formattable)
library(readr)
  
load("data/data.Rda")

datasets %>% 
  select(id, title, metric.views)

# Calcul du nombre de téléchargements
df_data_resources <- resources %>% 
  group_by(dataset.id, dataset.title) %>% 
  summarise(
    resources_n = n(), 
    resources_sum_downloads = sum(downloads)
    ) %>% 
  ungroup() %>% 
  select(
    dataset_id = dataset.id, 
    dataset_title = dataset.title, 
    resources_n, 
    resources_sum_downloads
    )

## Calcul des réutilisations
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
  summarise(reuses_n = n())

df_data <- df_data_resources %>% 
  left_join(df_data_reuses, by = "dataset_id") %>% 
  replace_na(list(reuses_n=0))

gg_downloads_and_reuses <- df_data %>% 
  ggplot() + 
  geom_point(
    mapping = aes(x = resources_sum_downloads, 
                  y = reuses_n), 
    color = "steelblue", alpha = .7, size = 2
      ) + 
  scale_x_continuous(
    labels = french_formatting, 
    name = "sum of downloads of all resources"
    ) + 
  scale_y_continuous(
    name = "# of reuses", 
    labels = french_formatting
    ) + 
  labs(title = "DataGouv : Total downloads vs # of reuses") + 
  theme_fivethirtyeight() + 
  theme(axis.title = element_text(), 
        rect = element_rect(fill = NA))

ggsave(gg_downloads_and_reuses, 
       filename = "figures/downloads_and_reuses.png", 
       width = 210, units = "mm", height = 148)

df_data %>% 
  lm(formula = reuses_n ~ resources_sum_downloads) %>% 
  summary()

df_data %>% 
  arrange(desc(reuses_n)) %>% 
  slice(1:20) %>% 
  View()

df_data %>% 
  arrange(desc(resources_sum_downloads)) %>% 
  slice(1:20) %>% 
  write_csv(path = "output/top20downloads.csv")

df_data %>% 
  arrange(desc(resources_sum_downloads)) %>% 
  slice(1:20) %>% 
  select(-dataset_id) %>% 
  datatable() %>% 
  saveWidget(file = "~/Documents/projets/exploreDataGouv/output/dt_top20.html")


html_top20downloads <- df_data %>% 
  arrange(desc(resources_sum_downloads)) %>% 
  slice(1:20) %>% 
  formattable(. , 
    list(
      resources_sum_downloads = color_bar("pink"), 
      reuses_n = color_tile("white", "orange")
      )
    )

saveWidget(html_top20downloads, 
           file = "~/Documents/projets/exploreDataGouv/output/top20_downloads.html")

library(DT)
html_df_data <- df_data %>% datatable(. , filter = 'top',
          caption = "Table Formacode",
          extensions = 'ColVis',
          options = list(autoWidth = FALSE,
                         pageLength = 5,
                         dom = 'C<"clear">lfrtip'), 
          rownames = FALSE)

saveWidget(html_df_data, 
           file = "~/Documents/projets/exploreDataGouv/figures/df_data.html")

