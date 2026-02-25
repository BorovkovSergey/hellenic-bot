INSERT INTO words (original, transcription, translations) VALUES
  ('γεια', 'yia', '{"en": "hello", "ru": "привет"}'),
  ('ευχαριστώ', 'efcharistó', '{"en": "thank you", "ru": "спасибо"}'),
  ('νερό', 'neró', '{"en": "water", "ru": "вода"}'),
  ('ψωμί', 'psomí', '{"en": "bread", "ru": "хлеб"}'),
  ('καλημέρα', 'kaliméra', '{"en": "good morning", "ru": "доброе утро"}'),
  ('αντίο', 'adío', '{"en": "goodbye", "ru": "до свидания"}'),
  ('παρακαλώ', 'parakaló', '{"en": "please / you''re welcome", "ru": "пожалуйста"}'),
  ('ναι', 'ne', '{"en": "yes", "ru": "да"}'),
  ('όχι', 'óchi', '{"en": "no", "ru": "нет"}'),
  ('καλησπέρα', 'kalispéra', '{"en": "good evening", "ru": "добрый вечер"}'),
  ('καληνύχτα', 'kaliníchta', '{"en": "good night", "ru": "спокойной ночи"}'),
  ('καλημέρα σας', 'kaliméra sas', '{"en": "good morning (formal)", "ru": "доброе утро (формальное)"}')
ON CONFLICT (original) DO NOTHING;
