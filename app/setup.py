import os

from setuptools import setup, find_packages

here = os.path.abspath(os.path.dirname(__file__))
with open(os.path.join(here, 'README.txt')) as f:
    README = f.read()
with open(os.path.join(here, 'CHANGES.txt')) as f:
    CHANGES = f.read()

requires = [
    #'plaster_pastedeploy',
    'pyramid >= 1.9a',
    #'pyramid_debugtoolbar',
    'pyramid_jinja2',
    'pyramid_retry',
    'pyramid_tm',
    'pyramid_jwt',
    'SQLAlchemy<1.4', # later versions conflict with gevent version of meinheld
    'transaction',
    'zope.sqlalchemy',
    #'waitress',
    'bcrypt',
    'xlsxwriter',
    'gevent < 21.8', # later versions require greenlet >=1.0, which conflicts with pyramid
    'gunicorn[gevent]',
    'meinheld',
    'websockets',
    'psycopg2-binary',
    'pyzmq',
]

tests_require = [
    'WebTest >= 1.3.1',  # py3 compat
    'pytest',
    'pytest-cov',
]

setup(
    name='surfjudge',
    version='1.0',
    description='surfjudge',
    long_description=README + '\n\n' + CHANGES,
    classifiers=[
        'Programming Language :: Python',
        'Framework :: Pyramid',
        'Topic :: Internet :: WWW/HTTP',
        'Topic :: Internet :: WWW/HTTP :: WSGI :: Application',
    ],
    author='Dario Goetz',
    author_email='',
    url='',
    keywords='web pyramid pylons',
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    extras_require={
        'testing': tests_require,
    },
    install_requires=requires,
    entry_points={
        'paste.app_factory': [
            'main = surfjudge:main',
        ],
        'console_scripts': [
            'initialize_surfjudge_db = surfjudge.scripts.initializedb:main',
        ],
    },
)
