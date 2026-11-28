from django.contrib.gis.geos import Point
from django.db import connection
from django.test import TestCase

MONAS = Point(106.8272, -6.1754, srid=4326)
BUNDARAN_HI = Point(106.8230, -6.1951, srid=4326)


class DatabaseExtensionTests(TestCase):
    def test_postgis_measures_geos_points_in_metres(self):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT ST_Distance(a, b), ST_DWithin(a, b, 3000), ST_DWithin(a, b, 2000)"
                " FROM (SELECT %s::geometry::geography AS a, %s::geometry::geography AS b) AS points",
                [MONAS.hexewkb.decode(), BUNDARAN_HI.hexewkb.decode()],
            )
            metres, within_3_km, within_2_km = cursor.fetchone()
        self.assertAlmostEqual(metres, 2240, delta=30)
        self.assertTrue(within_3_km)
        self.assertFalse(within_2_km)

    def test_pgvector_computes_euclidean_distance(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT '[1,2,3]'::vector <-> '[1,2,7]'::vector")
            (distance,) = cursor.fetchone()
        self.assertEqual(distance, 4.0)
