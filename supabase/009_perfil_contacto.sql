-- ---------------------------------------------------------------------
-- 009_perfil_contacto
-- Datos de contacto opcionales en el perfil (teléfono, localidad, correo
-- electrónico), pensados para poder ofrecerle a la persona usuaria los
-- desarrollos de dis+capacidad si ella decide dejarlos. Mismo patrón que
-- las columnas existentes de profiles: texto, no nulo, default ''.
-- Ver claude/"Datos personales de usuarios - asesoramiento y plan" en el
-- proyecto por las implicancias de la Ley 25.326 antes de usar estos datos
-- para contacto comercial.
-- ---------------------------------------------------------------------

alter table public.profiles
  add column telefono text not null default '',
  add column localidad text not null default '',
  add column email_contacto text not null default '';
