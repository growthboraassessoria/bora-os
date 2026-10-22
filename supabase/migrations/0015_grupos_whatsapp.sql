-- Grupos de WhatsApp dos 19 estados sem praça da BORA (planilha Grupos_WhatsApp_Estados, Alex, 22/10/2026).
-- A página de obrigado da LP mostra o botão do grupo do estado de quem se cadastrou.
-- SP, MG, RJ, ES, SC, RN, PE e DF ficam sem grupo: lá a BORA já tem praça.
update public.states s set whatsapp_url = v.url
from (values
  ('AC', 'https://chat.whatsapp.com/HPPOhjkHwcY9VmJunjQI1X'),
  ('AP', 'https://chat.whatsapp.com/LxTsGdQgM0y88HtgpN7ycv'),
  ('AM', 'https://chat.whatsapp.com/GZtwmYs4euyBDEarOqKTto'),
  ('PA', 'https://chat.whatsapp.com/EA4tv8dK6uv8y6zz28Tr7y'),
  ('RO', 'https://chat.whatsapp.com/LPkbw8aRQn2AVTXbW1inps'),
  ('RR', 'https://chat.whatsapp.com/FVYG7UUDZWI2gFN3OI0XTQ'),
  ('TO', 'https://chat.whatsapp.com/LE7lCc7QOBV8IOeM1Ibajc'),
  ('AL', 'https://chat.whatsapp.com/FWr5fVKHC4DAz71MsuAvfs'),
  ('BA', 'https://chat.whatsapp.com/GjIUALCBNwM5fyRELLxyi8'),
  ('CE', 'https://chat.whatsapp.com/LXiOc0R4ACIAsrYdmryqaq'),
  ('MA', 'https://chat.whatsapp.com/C859UTG9YGiGv2XW1cnGOb'),
  ('PB', 'https://chat.whatsapp.com/K760VehMYPZ7k7cLJNxcNv'),
  ('PI', 'https://chat.whatsapp.com/GKMZlPqYhyc1AqesRlo75B'),
  ('SE', 'https://chat.whatsapp.com/KKM0yuWBe6K53ZTVUMQXUz'),
  ('GO', 'https://chat.whatsapp.com/LZJ3Jn0XuZg1CBChcRlWfU'),
  ('MT', 'https://chat.whatsapp.com/HVlnWyZB6aREbW36CRebAP'),
  ('MS', 'https://chat.whatsapp.com/FxanPRUwQTHJz2INS0imOs'),
  ('PR', 'https://chat.whatsapp.com/J4LglPp7yu4D3HX5TNnfI6'),
  ('RS', 'https://chat.whatsapp.com/DTVDYc98oWZ7JQAVsIJOwx')
) as v(uf, url)
where s.uf = v.uf;
