library(ggplot2)
load("data/df_data_top200.Rda")

gg_data_followers_top20 <- df_data_top200 %>% 
  mutate(followers_n_rank = rank(-followers_n, ties.method = "first")) %>% 
  arrange(desc(followers_n)) %>%
  slice(1:20) %>% 
  ggplot() + 
  geom_point(
    mapping = aes(
      x = followers_n, 
      y = reorder(dataset_title, -followers_n_rank)
    ), 
    color = "tomato"
  ) + 
  scale_y_discrete(name = "Jeu de données (classés par rang)") + 
  scale_x_continuous(name = "Nombre de followers", 
                     limits = c(0,60)) 

gg_data_followers_top20

ggsave(plot = gg_data_followers_top20, 
       file = "output/data_followers_top20.png", 
       width = 294, 
       height = 294/2, units = "mm"
       )

