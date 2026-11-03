import unittest
from document_screening import screen_text, screen_file, screening_passed
from credential_policy import employer_checks, submitted, current_file

BLS = 'American Heart Association\nBLS Provider Certification Card\nJane Doe\nExpiration date: 12/31/2099'
RN = 'State of California Board of Registered Nursing\nRegistered Nurse License\nJane Doe\nLicense number: RN123456\nExpiration date: 12/31/2099'

class ScreeningTests(unittest.TestCase):
    def test_readable_credentials_pass_with_expiration(self):
        for text, kind in ((BLS, 'BLS'), (RN, 'RN License')):
            result=screen_text(text,kind,'Jane Doe')
            self.assertEqual(result['screening_status'],'passed',result)
            self.assertEqual(result['parsed_expiration_date'],'2099-12-31')
            self.assertEqual(result['authenticity_status'],'not_checked')
    def test_unrelated_expired_document_is_rejected_for_type_first(self):
        result=screen_text('Utility invoice for Jane Doe. Account payment expiration date: 01/01/2000', 'RN License','Jane Doe')
        self.assertEqual(result['screening_status'],'rejected')
        self.assertIsNone(result['parsed_expiration_date'])
    def test_mentions_in_resume_are_not_credential_evidence(self):
        self.assertEqual(screen_text(RN+'\nEmployment history and professional summary','RN License','Jane Doe')['screening_status'],'rejected')
    def test_other_credential_wrong_holder_ambiguous_expiry_and_missing_number(self):
        self.assertEqual(screen_text(BLS,'RN License','Jane Doe')['screening_status'],'rejected')
        for text,name in ((BLS,'Someone Else'),(BLS+'\nExpires: 01/01/2098','Jane Doe'),(RN.replace('License number: RN123456',''),'Jane Doe'),('','Jane Doe')):
            self.assertEqual(screen_text(text,'RN License' if 'Registered' in text else 'BLS',name)['screening_status'],'needs_review')
    def test_expired_credential_cannot_pass(self):
        self.assertEqual(screen_text(BLS.replace('2099','2000'),'BLS','Jane Doe')['screening_status'],'expired')
    def test_pdf_extraction_runs_same_content_checks(self):
        import fitz
        pdf=fitz.open(); page=pdf.new_page(); page.insert_text((50,50),RN)
        self.assertEqual(screen_file(pdf.tobytes(),'application/pdf','RN License','Jane Doe')['screening_status'],'passed')
        pdf.close()
    def test_editing_screened_metadata_invalidates_approval(self):
        doc=dict(screening_version='content-v2',screening_status='passed',verification_status='verified',category='license',screened_category='license',subtype='RN License',screened_subtype='RN License',expiration_date='2099-12-31',screened_expiration_date='2099-12-31')
        self.assertTrue(screening_passed(doc))
        self.assertFalse(screening_passed({**doc,'expiration_date':'2099-01-01'}))
        self.assertFalse(screening_passed({**doc,'subtype':'BLS'}))

if __name__=='__main__': unittest.main()

class VaultPipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_correct_date_only_after_type_check_and_persist_safe_status(self):
        import ast
        from pathlib import Path
        from types import SimpleNamespace
        from unittest.mock import AsyncMock
        from datetime import datetime, timezone
        import logging
        source=ast.parse(Path('backend/routes/vault.py').read_text())
        functions=[node for node in source.body if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and node.name in ('_run_verification_pipeline','_compute_compliance_status')]
        for text,expected in ((BLS,'passed'),('Electric utility invoice. Jane Doe. Expiration: 01/01/2000','rejected')):
            doc={'id':'test','category':'certification','subtype':'BLS','expiration_date':'2098-01-01'}
            collection=SimpleNamespace(find_one=AsyncMock(return_value=doc),update_one=AsyncMock())
            ns=dict(db=SimpleNamespace(vault_documents=collection),screen_file=screen_file,screening_passed=screening_passed,
                    SCREENING_VERSION='content-v2',employer_checks=employer_checks,submitted=submitted,current_file=current_file,datetime=datetime,timezone=timezone,logger=logging.getLogger('test'),_is_expirable=lambda c,s: True)
            exec(compile(ast.Module(body=functions,type_ignores=[]),'vault_pipeline','exec'),ns)
            import fitz
            pdf=fitz.open();pdf.new_page().insert_text((50,50),text)
            await ns['_run_verification_pipeline']('test',pdf.tobytes(),'application/pdf','2098-01-01','BLS','Jane Doe')
            update=collection.update_one.call_args.args[1]['$set']
            self.assertEqual(update['screening_status'],expected)
            if expected=='passed': self.assertEqual(update['expiration_date'],'2099-12-31')
            else: self.assertNotIn('expiration_date',update)
            pdf.close()
