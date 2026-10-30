import {html,t} from '../localization'
import {languageOf} from '../localization'
import {card,form,h} from './shared'
export function personalLanguageSettings(s:any){
 if(!s.actor.staffId)return ''
 return card(t(s,'Settings'),form('clocklanguage.save','/app/settings',html(s)`<label>My language<select name="language"><option value="en" ${languageOf(s)==='en'?'selected':''}>English</option><option value="es" ${languageOf(s)==='es'?'selected':''}>Español</option></select></label><p>This is your own preference for the staff journey and shared clock. It does not change text written by people.</p>`,t(s,'Save language')))
}
